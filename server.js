const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");

const PORT = 8080;
const ROOT_DIR = __dirname;
const EXCLUDED_DIRS = new Set([".git", "node_modules"]);
const REMOTE_TOKEN = process.env.REMOTE_TOKEN || "";
const WAKE_MAC = process.env.WAKE_MAC || "";

const PREVIEW_FILES = new Set(["overview.png", "deals.png", "team.png", "privacy.png"]);
const sseClients = new Set();
const commandQueue = [];
let nextCommandId = 1;
let lastCommand = null;
const MAX_COMMANDS = 300;
const dashboardState = {
  scalePercent: 100,
  updatedAt: Date.now()
};

const KEY_MAP = {
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  zoom_in: "equal",
  zoom_out: "minus",
  zoom_reset: "0",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  enter: "Return",
};

const CONTENT_TYPE = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const DASHBOARD_WINDOW_TITLES = [
  "ASG Live Team Performance",
  "Multi View TV Dashboard",
  "tv-dashboard-multiview"
];

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function isAuthorized(reqUrl) {
  if (!REMOTE_TOKEN) return true;
  const token = reqUrl.searchParams.get("token");
  return token === REMOTE_TOKEN;
}

function requireAuth(reqUrl, res) {
  if (isAuthorized(reqUrl)) return true;
  sendJson(res, 401, { error: "unauthorized" });
  return false;
}

function safeResolve(relPath = "") {
  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const fullPath = path.resolve(ROOT_DIR, normalized);
  if (!fullPath.startsWith(ROOT_DIR)) {
    throw new Error("Invalid path");
  }
  return fullPath;
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return [".html", ".js", ".json", ".md", ".css", ".txt", ".gs", ".yml", ".yaml", ".gitignore"].includes(ext)
    || path.basename(filePath) === "README";
}

function walkFiles(dir, base = ROOT_DIR, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".gitignore") {
      continue;
    }
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).split(path.sep).join("/");
    if (entry.isDirectory()) {
      walkFiles(full, base, results);
    } else {
      results.push(rel);
    }
  }
  return results.sort((a, b) => a.localeCompare(b));
}

function keyToDomKey(k) {
  const map = {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    enter: "Enter",
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    zoom_in: "=",
    zoom_out: "-",
    zoom_reset: "0"
  };
  return map[k] || "";
}

function broadcastCommand(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

function enqueueCommand(type, key) {
  const cmd = { id: nextCommandId++, type, key, at: Date.now() };
  commandQueue.push(cmd);
  if (commandQueue.length > MAX_COMMANDS) {
    commandQueue.splice(0, commandQueue.length - MAX_COMMANDS);
  }
  lastCommand = cmd;
  return cmd;
}

function sendXdoKey(xkey) {
  const env = { ...process.env, DISPLAY: process.env.XDISPLAY || ":0" };
  let targetWindowId = "";

  for (const title of DASHBOARD_WINDOW_TITLES) {
    try {
      const result = execFileSync("xdotool", ["search", "--name", title], { env, encoding: "utf8" });
      const firstId = String(result).trim().split("\n")[0];
      if (firstId) {
        targetWindowId = firstId;
        break;
      }
    } catch (_) {
      // Try next title candidate.
    }
  }

  if (targetWindowId) {
    execFileSync("xdotool", ["windowactivate", "--sync", targetWindowId], { env });
    execFileSync("xdotool", ["key", "--window", targetWindowId, xkey], { env });
    return { targeted: true, windowId: targetWindowId };
  }

  // Fallback to active window in case title matching fails.
  execFileSync("xdotool", ["key", xkey], { env });
  return { targeted: false, windowId: null };
}

function wakePi() {
  if (!WAKE_MAC) {
    throw new Error("WAKE_MAC is not configured");
  }
  try {
    execFileSync("wakeonlan", [WAKE_MAC], { stdio: "ignore" });
    return;
  } catch (_) {
    execFileSync("etherwake", [WAKE_MAC], { stdio: "ignore" });
  }
}

function runDashboardUpdate(branch = "main") {
  const scriptPath = path.join(ROOT_DIR, "scripts", "pi-update-dashboard.sh");
  if (!fs.existsSync(scriptPath)) {
    throw new Error("Update script not found: " + scriptPath);
  }
  try {
    return execFileSync("bash", [scriptPath, branch], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (err) {
    const out = (err && err.stdout ? String(err.stdout) : "").trim();
    const detail = (err && err.stderr ? String(err.stderr) : "").trim();
    const msg = [out, detail].filter(Boolean).join("\n");
    throw new Error(msg || (err && err.message ? err.message : "Dashboard update failed"));
  }
}

function hardRefreshDashboardWindow() {
  try {
    return sendXdoKey("ctrl+shift+r");
  } catch (_) {
    return sendXdoKey("F5");
  }
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const reqUrl = new URL(req.url, "http://localhost");
  const pathname = reqUrl.pathname;

  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    if (!requireAuth(reqUrl, res)) return;
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(fs.readFileSync(path.join(__dirname, "index.html")));
    return;
  }

  if (req.method === "GET" && pathname === "/dashboard") {
    const dashboardPath = path.join(__dirname, "asg-admin-hub", "components", "tv-dashboard-multiview.html");
    try {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(fs.readFileSync(dashboardPath));
    } catch (_) {
      res.writeHead(404);
      res.end("Dashboard not found");
    }
    return;
  }

  if (req.method === "GET" && pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    res.write("retry: 1000\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (req.method === "GET" && pathname === "/api/commands") {
    const after = Number(reqUrl.searchParams.get("after") || 0);
    const commands = Number.isFinite(after)
      ? commandQueue.filter((c) => c.id > after)
      : commandQueue;
    sendJson(res, 200, {
      commands,
      latestId: commandQueue.length ? commandQueue[commandQueue.length - 1].id : 0
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/remote-status") {
    sendJson(res, 200, {
      sseClients: sseClients.size,
      queueSize: commandQueue.length,
      latestId: commandQueue.length ? commandQueue[commandQueue.length - 1].id : 0,
      lastCommand
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/dashboard-state") {
    sendJson(res, 200, dashboardState);
    return;
  }

  if (req.method === "POST" && pathname === "/api/dashboard-state") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const n = Number(payload.scalePercent);
        if (!Number.isFinite(n)) {
          sendJson(res, 400, { error: "scalePercent must be a number" });
          return;
        }
        dashboardState.scalePercent = Math.max(50, Math.min(200, Math.round(n)));
        dashboardState.updatedAt = Date.now();
        sendJson(res, 200, { ok: true, dashboardState });
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
    });
    return;
  }

  if (req.method === "GET" && pathname === "/workspace") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(path.join(__dirname, "workspace.html")));
    return;
  }

  if (req.method === "GET" && pathname === "/api/files") {
    try {
      sendJson(res, 200, { files: walkFiles(ROOT_DIR) });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/file") {
    const relPath = reqUrl.searchParams.get("path") || "";
    try {
      const filePath = safeResolve(relPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        sendJson(res, 404, { error: "File not found" });
        return;
      }
      if (!isTextFile(filePath)) {
        sendJson(res, 400, { error: "Only text-like files are editable in workspace view" });
        return;
      }
      const content = fs.readFileSync(filePath, "utf8");
      sendJson(res, 200, { path: relPath, content });
    } catch (e) {
      sendJson(res, 400, { error: e.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/file") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { filePath, content } = JSON.parse(body);
        if (typeof filePath !== "string" || typeof content !== "string") {
          sendJson(res, 400, { error: "filePath and content must be strings" });
          return;
        }
        const fullPath = safeResolve(filePath);
        if (!isTextFile(fullPath)) {
          sendJson(res, 400, { error: "Only text-like files are editable in workspace view" });
          return;
        }
        fs.writeFileSync(fullPath, content, "utf8");
        sendJson(res, 200, { ok: true, filePath });
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
    });
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/raw/")) {
    const relPath = pathname.replace(/^\/raw\//, "");
    try {
      const filePath = safeResolve(relPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const type = CONTENT_TYPE[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      res.end(fs.readFileSync(filePath));
    } catch (_) {
      res.writeHead(400);
      res.end("Invalid path");
    }
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/previews/")) {
    if (!requireAuth(reqUrl, res)) return;
    const name = path.basename(pathname);
    if (!PREVIEW_FILES.has(name)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const filePath = path.join(__dirname, "previews", name);
    try {
      const buf = fs.readFileSync(filePath);
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      });
      res.end(buf);
    } catch (_) {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }

  if (req.method === "POST" && pathname === "/key") {
    if (!requireAuth(reqUrl, res)) return;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { key } = JSON.parse(body);
        const xkey = KEY_MAP[key];
        if (!xkey) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid key" }));
          return;
        }
        const domKey = keyToDomKey(key);
        if (domKey) {
          const command = enqueueCommand("key", domKey);
          broadcastCommand(command);
        }

        let result = { targeted: false, windowId: null, injected: false, injectionError: null };
        try {
          const injected = sendXdoKey(xkey);
          result = { ...injected, injected: true, injectionError: null };
        } catch (injectErr) {
          result.injectionError = injectErr.message;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            key: xkey,
            targeted: result.targeted,
            windowId: result.windowId,
            injected: result.injected,
            injectionError: result.injectionError
          })
        );
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && pathname === "/power") {
    if (!requireAuth(reqUrl, res)) return;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { action } = JSON.parse(body);
        if (action === "shutdown") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, action: "shutdown" }));
          // Give response time to send before shutting down
          setTimeout(() => {
            try { execSync("sudo shutdown -h now"); } catch (_) {}
          }, 500);
        } else if (action === "reboot") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, action: "reboot" }));
          setTimeout(() => {
            try { execSync("sudo reboot"); } catch (_) {}
          }, 500);
        } else if (action === "wake") {
          try {
            wakePi();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, action: "wake" }));
          } catch (wakeErr) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "wake_failed", detail: wakeErr.message }));
          }
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid action" }));
        }
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/update-dashboard") {
    if (!requireAuth(reqUrl, res)) return;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const branch = String(payload.branch || "main").trim() || "main";
        const hardRefresh = payload.hardRefresh !== false;
        const output = runDashboardUpdate(branch);
        let refresh = null;
        if (hardRefresh) {
          try {
            const result = hardRefreshDashboardWindow();
            refresh = { ok: true, ...result };
          } catch (refreshErr) {
            refresh = { ok: false, error: String(refreshErr.message || refreshErr) };
          }
        }
        sendJson(res, 200, {
          ok: true,
          branch,
          output,
          refresh
        });
      } catch (e) {
        sendJson(res, 500, { error: "update_failed", detail: String(e.message || e) });
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`Workspace editor: http://0.0.0.0:${PORT}/workspace`);
  console.log(`Dashboard URL: http://0.0.0.0:${PORT}/dashboard`);
  if (REMOTE_TOKEN) {
    console.log("Remote link protection is ON (token required).");
  } else {
    console.log("Remote link protection is OFF (set REMOTE_TOKEN to enable).");
  }
});
