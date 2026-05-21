#!/usr/bin/env node
/**
 * Освобождает dev-порты на Windows (старый node/next часто остаётся после закрытия терминала).
 * PORTS=3055 или PORTS=3055,3056 — по умолчанию оба.
 */
const { execSync } = require("child_process");

const raw = (process.env.PORTS || process.env.PORT || "3055,3056").trim();
const PORTS = raw
  .split(",")
  .map((p) => Number(p.trim()))
  .filter((p) => Number.isFinite(p) && p > 0);

function pidsOnPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr /R /C:":${port} "`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0") pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

let killed = 0;
for (const port of PORTS) {
  const pids = pidsOnPort(port);
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      console.log(`Порт ${port}: завершён процесс PID ${pid}`);
      killed += 1;
    } catch {
      try {
        execSync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force"`, {
          stdio: "ignore",
        });
        console.log(`Порт ${port}: завершён PID ${pid} (Stop-Process)`);
        killed += 1;
      } catch {
        console.warn(`Порт ${port}: не удалось завершить PID ${pid} — закройте в Диспетчере задач`);
      }
    }
  }
  if (pids.length === 0) {
    console.log(`Порт ${port}: свободен`);
  }
}

if (killed === 0) {
  console.log("\nГотово. Запустите: npm run dev:subs  или  npm run dev:gpt");
} else {
  console.log(`\nГотово (${killed} процесс(ов)).`);
}
