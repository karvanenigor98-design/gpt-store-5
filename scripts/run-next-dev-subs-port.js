#!/usr/bin/env node
/** Subs Store local: http://127.0.0.1:3055/spotify */
const path = require("path");
const { execSync } = require("child_process");
try {
  execSync(`node "${path.join(__dirname, "free-dev-ports.js")}"`, {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORTS: "3055" },
  });
} catch {
  // ignore
}
process.env.PORT = "3055";
process.env.GPT_STORE_STRICT_PORT = "1";
process.env.DEV_STORE_PROFILE = "subs-store";
process.env.NEXT_DEV_DIST_DIR = ".next-subs";
require("./run-next-dev.js");
