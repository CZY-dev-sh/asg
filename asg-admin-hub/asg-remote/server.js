const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PORT = 8080;

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

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Remote control server running at http://0.0.0.0:${PORT}`);
});
