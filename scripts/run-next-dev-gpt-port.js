#!/usr/bin/env node
/** GPT STORE local: http://127.0.0.1:3056/ */
const path = require("path");
const { execSync } = require("child_process");
try {
  execSync(`node "${path.join(__dirname, "free-dev-ports.js")}"`, {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORTS: "3056" },
  });
} catch {
  // ignore
}
process.env.PORT = "3056";
process.env.GPT_STORE_STRICT_PORT = "1";
process.env.DEV_STORE_PROFILE = "gpt-store";
process.env.NEXT_DEV_DIST_DIR = ".next-gpt";
require("./run-next-dev.js");
