/**
 * npm при `npm run dev` обычно ставит cwd в корень пакета, но если в `.next` лежит
 * чужой package.json или команды запускают node вручную из неверной папки —
 * сборка ломается. Проверяем, что мы в корне gpt_spotify_site.
 */
const fs = require("fs");
const path = require("path");

const cwd = path.resolve(process.cwd());
const pkgPath = path.join(cwd, "package.json");
const nextCfg = path.join(cwd, "next.config.mjs");

if (!fs.existsSync(pkgPath) || !fs.existsSync(nextCfg)) {
  console.error(
    "\n\x1b[31m[gpt_spotify_site]\x1b[0m Запуск только из корня репозитория (рядом с package.json и next.config.mjs).\n" +
      "   Сейчас: \x1b[33m" +
      cwd +
      "\x1b[0m\n" +
      "   Сделайте: \x1b[32mcd\x1b[0m в папку \x1b[32mChat_Spotify-main\x1b[0m, затем снова \x1b[32mnpm run dev\x1b[0m.\n"
  );
  process.exit(1);
}

let name;
try {
  name = JSON.parse(fs.readFileSync(pkgPath, "utf8")).name;
} catch {
  console.error("\n\x1b[31m[gpt_spotify_site]\x1b[0m Не удалось прочитать package.json в " + cwd + "\n");
  process.exit(1);
}

if (name !== "gpt_spotify_site") {
  console.error(
    "\n\x1b[31m[gpt_spotify_site]\x1b[0m Ожидается пакет \x1b[32mgpt_spotify_site\x1b[0m, найдено: \x1b[33m" +
      name +
      "\x1b[0m\n" +
      "   Перейдите в корень проекта Chat_Spotify-main.\n"
  );
  process.exit(1);
}
