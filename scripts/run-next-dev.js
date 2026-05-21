const { spawn, exec } = require("child_process");
const net = require("net");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const cleanScript = path.join(projectRoot, "scripts", "clean-next.js");

function canListenOnPort(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    if (host) {
      server.listen(port, host);
    } else {
      server.listen(port);
    }
  });
}

async function getAvailablePort(startPort, host, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = startPort + i;
    // eslint-disable-next-line no-await-in-loop
    const isFree = await canListenOnPort(candidate, host);
    if (isFree) {
      return String(candidate);
    }
  }

  throw new Error(`No free port found from ${startPort} to ${startPort + maxAttempts - 1}`);
}

const clean = spawn(process.execPath, [cleanScript], {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

clean.on("exit", async (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
    return;
  }

  // HOST не задаём по умолчанию: Next слушает без -H → localhost (IPv4/IPv6) работает в Edge.
  // Телефон в LAN: HOST=0.0.0.0 npm run dev; только IPv4: HOST=127.0.0.1 npm run dev
  const devHost = (process.env.HOST || "").trim() || undefined;
  const basePort = Number(process.env.PORT || "3055");
  const strictPort = String(process.env.GPT_STORE_STRICT_PORT || "") === "1";

  let devPort;
  try {
    if (strictPort) {
      const free = await canListenOnPort(basePort, devHost);
      if (!free) {
        console.error(
          `\n\x1b[31m[gpt_spotify_site]\x1b[0m Порт \x1b[33m${basePort}\x1b[0m занят — сервер не запущен (фиксированный порт для закладки http://127.0.0.1:${basePort}/).\n` +
            `   Закройте другой процесс на этом порту или задайте \x1b[32mPORT=другой\x1b[0m.\n` +
            `   Windows: \x1b[33mnetstat -ano | findstr :${basePort}\x1b[0m  →  PID в последнем столбце → «Завершить задачу» в Диспетчере.\n` +
            `   Если нужен свободный следующий порт: \x1b[32mnpm run dev:flexport\x1b[0m\n`
        );
        process.exit(1);
        return;
      }
      devPort = String(basePort);
    } else {
      devPort = await getAvailablePort(basePort, devHost);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
    return;
  }

  if (!strictPort && devPort !== String(basePort)) {
    console.log(`Port ${basePort} is busy, starting dev server on ${devPort}`);
  }

  const hostForLinks =
    devHost === "0.0.0.0" ? "127.0.0.1" : devHost === "127.0.0.1" ? "127.0.0.1" : "localhost";
  const base = `http://${hostForLinks}:${devPort}`;
  const profile = (process.env.DEV_STORE_PROFILE || "").trim();
  const isSubsProfile = profile === "subs-store" || devPort === "3055";
  const isGptProfile = profile === "gpt-store" || devPort === "3056";
  const storeLabel = isSubsProfile && !isGptProfile
    ? "SUBS STORE · Spotify"
    : isGptProfile && !isSubsProfile
      ? "GPT STORE · ChatGPT"
      : "GPT + Subs (один порт)";
  const accent = isSubsProfile && !isGptProfile ? "\x1b[32m" : isGptProfile ? "\x1b[36m" : "\x1b[33m";

  console.log("");
  console.log(`${accent}\x1b[1m  ╔══════════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`${accent}\x1b[1m  ║  ${storeLabel.padEnd(54)}║\x1b[0m`);
  console.log(`${accent}\x1b[1m  ║  npm run ${isGptProfile ? "dev:gpt" : isSubsProfile ? "dev:subs" : "dev"} · порт :${devPort}${" ".repeat(Math.max(0, 28 - String(devPort).length))}║\x1b[0m`);
  console.log(`${accent}\x1b[1m  ╚══════════════════════════════════════════════════════════╝\x1b[0m`);
  console.log("");
  console.log("\x1b[1m\x1b[33m══════════════════════════════════════════════════════════════\x1b[0m");
  console.log("\x1b[1m  Откройте в браузере С ПОРТОМ (иначе будет «отказано в подключении»):\x1b[0m");
  if (isSubsProfile && !isGptProfile) {
    console.log(`\x1b[1m\x1b[32m  ${base}/spotify\x1b[0m  ← ЛЕНДИНГ (npm run dev:subs · landing:subs)`);
  } else if (isGptProfile) {
    console.log(`\x1b[1m\x1b[36m  ${base}/\x1b[0m  ← ЛЕНДИНГ (npm run dev:gpt · landing:gpt)`);
  } else {
    console.log(`\x1b[1m\x1b[36m  ${base}/\x1b[0m  ·  ${base}/spotify`);
  }
  console.log("\x1b[1m\x1b[33m══════════════════════════════════════════════════════════════\x1b[0m");
  console.log("");
  console.log("  —— Локальные ссылки (скопируйте в браузер) ——");
  if (isSubsProfile && !isGptProfile) {
    console.log(`  Subs лендинг:         ${base}/spotify`);
    console.log(`  Subs кабинет:         ${base}/dashboard?site=subs-store`);
    console.log(`  Subs вход:            ${base}/login?site=subs-store`);
    console.log(`  Subs админка:         ${base}/admin?site=subs-store`);
  } else if (isGptProfile) {
    console.log(`  GPT главная:          ${base}/`);
    console.log(`  GPT кабинет:          ${base}/dashboard`);
    console.log(`  GPT вход:             ${base}/login`);
    console.log(`  GPT админка:          ${base}/admin?site=gpt-store`);
  } else {
    console.log(`  GPT STORE главная:    ${base}/`);
    console.log(`  Subs Store:           ${base}/spotify`);
    console.log(`  Админка:               ${base}/admin`);
    console.log(`  Регистрация / вход:   ${base}/register  ·  ${base}/login`);
  }
  console.log("");
  console.log(
    `  Важно: адрес без порта (http://localhost) — это порт :80. Нужен явный порт, например :${devPort}.`
  );
  console.log(`  Пример: ${base}/register  ·  http://127.0.0.1:${devPort}/`);
  console.log("  Не открывайте в браузере http://0.0.0.0 — используйте 127.0.0.1 с портом (не смешивайте с localhost).");
  if (process.env.NEXT_DEV_DIST_DIR) {
    console.log(`  Кэш сборки: ${process.env.NEXT_DEV_DIST_DIR} (можно параллельно dev:subs + dev:gpt).`);
  }
  console.log("");
  console.log(
    "  \x1b[90mЕсли в браузере «Cannot find module './undefined'» или 500 после HMR: Ctrl+C, затем\x1b[0m \x1b[1mnpm run dev:clean\x1b[0m \x1b[90m(полная очистка .next).\x1b[0m"
  );
  console.log("");

  const devEnv = { ...process.env };
  // Polling file watchers on Windows can cause unstable rebuild races in Next dev
  // (sporadic missing chunk/module files in .next/server). Keep it opt-in.
  if (String(process.env.NEXT_DEV_POLLING || "").toLowerCase() === "1") {
    devEnv.WATCHPACK_POLLING = "true";
    devEnv.CHOKIDAR_USEPOLLING = "1";
    devEnv.CHOKIDAR_INTERVAL = process.env.CHOKIDAR_INTERVAL || "500";
  }

  const nextArgs = [nextBin, "dev", "-p", devPort];
  if (devHost) {
    nextArgs.push("-H", devHost);
  }

  const dev = spawn(process.execPath, nextArgs, {
    cwd: projectRoot,
    stdio: "inherit",
    env: devEnv,
  });

  if (process.platform === "win32" && String(process.env.GPT_STORE_OPEN_BROWSER || "1") !== "0") {
    const subsOnly =
      process.env.DEV_STORE_PROFILE === "subs-store" ||
      (devPort === "3055" && process.env.DEV_STORE_PROFILE !== "gpt-store");
    const openPath = subsOnly ? "/spotify" : "/";
    const openUrl = `http://127.0.0.1:${devPort}${openPath}`;
    console.log(`\n  Браузер откроется: ${openUrl}\n`);
    setTimeout(() => {
      exec(`start "" "${openUrl}"`, { cwd: projectRoot }, () => {});
    }, 2600);
  }

  dev.on("exit", (devCode) => process.exit(devCode ?? 0));
});

