/**
 * Install VPS-local password grant so /api/auth/gpt-login never hits Vercel/GoTrue from FRA.
 * Usage: node scripts/deploy-gpt-login-sidecar.cjs
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const { GPTPLUS_VPS_HOST } = require("./lib/prod-vps.cjs");
const HOST = GPTPLUS_VPS_HOST;
const USER = process.env.VPS_USER || "root";
const KEY = process.env.VPS_SSH_KEY || path.join(ROOT, ".vps-deploy-key");
const SSH_OPTS = ["-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=25"];
const DIR = "/opt/gpt-login-sidecar";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : "pipe",
    cwd: ROOT,
  });
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} failed: ${(r.stderr || r.stdout || r.status || "").toString().trim()}`);
  }
  return r;
}

function ssh(remote) {
  return run("ssh", [...SSH_OPTS, `${USER}@${HOST}`, remote]);
}

function scp(local, remote) {
  return run("scp", [...SSH_OPTS, local, `${USER}@${HOST}:${remote}`]);
}

function parseEnvLocal() {
  const out = {};
  const envPath = path.join(ROOT, ".env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}

const env = parseEnvLocal();
const anon = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "").trim();
const url = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").trim();
if (!anon || !url) throw new Error("missing supabase url/anon in .env.local");
const gotrueHost = new URL(url).hostname;

const tmpEnv = path.join(os.tmpdir(), "gpt-login-sidecar.env");
fs.writeFileSync(
  tmpEnv,
  [
    `GOTRUE_HOST=${gotrueHost}`,
    `SUPABASE_ANON_KEY=${anon}`,
    `GOTRUE_IPS=8.6.112.0,8.47.69.0`,
    `BIND=127.0.0.1`,
    `PORT=3099`,
    `SITE_ORIGIN=https://gptplus-store.ru`,
    "",
  ].join("\n"),
  { encoding: "utf8", mode: 0o600 },
);

try {
  ssh(`mkdir -p ${DIR}`);
  scp(path.join(ROOT, "tools/vps-deploy/gpt-login-sidecar.py"), `${DIR}/gpt-login-sidecar.py`);
  scp(path.join(ROOT, "tools/vps-deploy/gpt-login-sidecar.service"), "/etc/systemd/system/gpt-login-sidecar.service");
  scp(tmpEnv, `${DIR}/.env`);
  scp(path.join(ROOT, "tools/vps-deploy/nginx-gptplus-https.conf"), "/etc/nginx/sites-available/gptplus");
  ssh(
    [
      `chmod 600 ${DIR}/.env`,
      `sed -i 's/\\r$//' ${DIR}/gpt-login-sidecar.py ${DIR}/.env /etc/systemd/system/gpt-login-sidecar.service`,
      `chmod +x ${DIR}/gpt-login-sidecar.py`,
      `systemctl daemon-reload`,
      `systemctl enable gpt-login-sidecar`,
      `systemctl restart gpt-login-sidecar`,
      `nginx -t`,
      `systemctl reload nginx`,
      `sleep 1`,
      `systemctl is-active gpt-login-sidecar`,
      `curl -sS -m 4 http://127.0.0.1:3099/health`,
    ].join(" && "),
  );
} finally {
  try {
    fs.unlinkSync(tmpEnv);
  } catch {
    /* ignore */
  }
}

const probe = ssh(
  `curl -sS -o /tmp/gpt-login-probe.txt -w '%{http_code} %{time_total} %{redirect_url}' -m 12 -X POST http://127.0.0.1:3099/api/auth/gpt-login -H 'Content-Type: application/x-www-form-urlencoded' -H 'Accept: text/html' --data 'email=nobody@example.com&password=wrongpassword123' ; echo; head -c 200 /tmp/gpt-login-probe.txt; echo`,
);
process.stdout.write((probe.stdout || "").trim() + "\n");

const live = run("curl", [
  "-sS",
  "-o",
  "NUL",
  "-w",
  "%{http_code} %{time_total} %{redirect_url}",
  "-m",
  "12",
  "-X",
  "POST",
  "https://gptplus-store.ru/api/auth/gpt-login",
  "-H",
  "Content-Type: application/x-www-form-urlencoded",
  "-H",
  "Accept: text/html",
  "--data",
  "email=nobody@example.com&password=wrongpassword123",
]);
process.stdout.write("live " + (live.stdout || "").trim() + "\n");
console.log("sidecar deployed on", HOST);
