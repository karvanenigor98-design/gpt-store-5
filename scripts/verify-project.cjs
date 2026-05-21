/**
 * Проверка проекта: tsc + next build. Пишет лог в verify-build.log
 * Запуск: node scripts/verify-project.cjs
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const logPath = path.join(root, "verify-build.log");
const lines = [`=== verify ${new Date().toISOString()} ===\n`];

function run(cmd, args, env = {}) {
  lines.push(`> ${cmd} ${args.join(" ")}\n`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096", ...env },
    encoding: "utf8",
    shell: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.stdout) lines.push(r.stdout);
  if (r.stderr) lines.push(r.stderr);
  lines.push(`\nexit: ${r.status ?? "?"}\n`);
  return r.status ?? 1;
}

const tscCode = run("npx", ["tsc", "--noEmit"]);
const buildCode = tscCode === 0 ? run("npx", ["next", "build"]) : -1;

lines.push(`\nSUMMARY: tsc=${tscCode} build=${buildCode}\n`);
fs.writeFileSync(logPath, lines.join(""), "utf8");
console.log(`Wrote ${logPath}`);
console.log(`tsc=${tscCode} build=${buildCode}`);
process.exit(tscCode === 0 && buildCode === 0 ? 0 : 1);
