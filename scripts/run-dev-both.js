#!/usr/bin/env node
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

require("./print-both-landings.js");

function start(name, script) {
  const child = spawn(npmCmd, ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env },
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] завершился с кодом ${code}`);
    }
  });
  return child;
}

const gpt = start("gpt", "dev:gpt");
const subs = start("subs", "dev:subs");

function shutdown() {
  gpt.kill("SIGTERM");
  subs.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
