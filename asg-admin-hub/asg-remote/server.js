const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");

const PORT = 8080;
const ROOT_DIR = path.resolve(__dirname, "..", "..");

const PREVIEW_FILES = new Set(["overview.png", "deals.png", "team.png", "privacy.png"]);

const KEY_MAP = {
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  enter: "Return",
};

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
  const env = { ...process.env, DISPLAY: process.env.XDISPLAY || ":0" };
  try {
    execFileSync("xdotool", ["key", "ctrl+shift+r"], { env });
  } catch (_) {
    execFileSync("xdotool", ["key", "F5"], { env });
  }
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(fs.readFileSync(path.join(__dirname, "index.html")));
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/previews/")) {
    const name = path.basename(req.url.split("?")[0]);
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

  if (req.method === "POST" && req.url === "/key") {
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
        execSync(`DISPLAY=:0 xdotool key ${xkey}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, key: xkey }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/power") {
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

  if (req.method === "POST" && req.url === "/api/update-dashboard") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const branch = String(payload.branch || "main").trim() || "main";
        const hardRefresh = payload.hardRefresh !== false;
        const output = runDashboardUpdate(branch);
        if (hardRefresh) {
          hardRefreshDashboardWindow();
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, branch, output, hardRefresh }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "update_failed", detail: String(e.message || e) }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Remote control server running at http://0.0.0.0:${PORT}`);
});
