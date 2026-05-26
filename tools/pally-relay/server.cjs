/**
 * Relay: один статический egress IP → Pally API (для IP whitelist).
 * Запуск: PALLY_RELAY_SECRET=xxx node server.cjs
 * Fly.io: fly ips allocate-v4 → этот IP в Pally whitelist.
 */
const http = require("http");
const https = require("https");

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.PALLY_RELAY_SECRET || "";
const DEFAULT_TARGET = (
  process.env.PALLY_TARGET_BASE || "https://pally.info/api/v1"
).replace(/\/$/, "");

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function forwardToPally(targetUrl, req, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const lib = u.protocol === "https:" ? https : http;
    const headers = {
      "Content-Type": req.headers["content-type"] || "application/json",
      Accept: req.headers.accept || "application/json",
      "User-Agent": req.headers["user-agent"] || "GPT-STORE-Pally-Relay/1.0",
    };
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }

    const r = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method: req.method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 502,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    r.on("error", reject);
    if (body.length) r.write(body);
    r.end();
  });
}

async function handleEgressIp(res) {
  const out = await forwardToPally("https://api.ipify.org?format=json", { method: "GET", headers: {} }, Buffer.alloc(0));
  res.writeHead(out.status, { "Content-Type": "application/json" });
  res.end(out.body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (SECRET) {
      const got = req.headers["x-pally-relay-secret"];
      if (got !== SECRET) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized relay" }));
        return;
      }
    }

    const path = req.url?.split("?")[0] || "/";

    if (path === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (path === "/egress-ip" && req.method === "GET") {
      await handleEgressIp(res);
      return;
    }

    const targetBase = (req.headers["x-pally-target-base"] || DEFAULT_TARGET).replace(/\/$/, "");
    const targetUrl = `${targetBase}${path}`;

    const body = await readBody(req);
    const out = await forwardToPally(targetUrl, req, body);

    res.writeHead(out.status, { "Content-Type": out.headers["content-type"] || "application/json" });
    res.end(out.body);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : "relay error" }));
  }
});

server.listen(PORT, () => {
  console.log(`Pally relay listening on :${PORT}`);
  console.log(`Target base: ${DEFAULT_TARGET}`);
  console.log(`Auth: ${SECRET ? "secret required" : "OPEN (set PALLY_RELAY_SECRET)"}`);
});
