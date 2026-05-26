/**
 * Деплой relay на Fly.io (нужны: flyctl + fly auth login).
 * node scripts/deploy-pally-relay-fly.cjs
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const RELAY = path.join(ROOT, "tools", "pally-relay");
const SETUP = path.join(ROOT, ".pally-relay-setup.local.json");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || RELAY,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
    ...opts,
  });
  return r.status === 0;
}

function loadSetup() {
  if (!fs.existsSync(SETUP)) {
    console.error("Сначала: node scripts/setup-pally-relay-complete.cjs");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(SETUP, "utf8"));
}

function main() {
  const setup = loadSetup();
  const secret = setup.PALLY_RELAY_SECRET;

  if (!run("fly", ["version"])) {
    console.error("\nУстанови flyctl: https://fly.io/docs/hands-on/install-flyctl/");
    console.error("Windows: iwr https://fly.io/install.ps1 -useb | iex");
    process.exit(1);
  }

  if (!run("fly", ["auth", "whoami"])) {
    console.error("\nВыполни: fly auth login");
    process.exit(1);
  }

  console.log("\n→ fly secrets set PALLY_RELAY_SECRET");
  if (!run("fly", ["secrets", "set", `PALLY_RELAY_SECRET=${secret}`])) process.exit(1);

  console.log("\n→ fly ips allocate-v4 (если ещё нет)");
  run("fly", ["ips", "allocate-v4"]);

  console.log("\n→ fly deploy");
  if (!run("fly", ["deploy", "--ha=false"])) process.exit(1);

  console.log("\n→ fly ips list");
  run("fly", ["ips", "list"]);

  const app = setup.PALLY_RELAY_URL_fly?.replace("https://", "").split("/")[0] || "gpt-store-pally-relay.fly.dev";
  setup.PALLY_RELAY_URL_deployed = `https://${app}`;
  fs.writeFileSync(SETUP, JSON.stringify(setup, null, 2));

  console.log("\n=== Готово ===");
  console.log("Relay URL:", setup.PALLY_RELAY_URL_deployed);
  console.log("IP из fly ips list → единственный адрес в Pally whitelist");
  console.log("Дальше: node scripts/set-pally-relay-vercel-env.cjs");
}

main();
