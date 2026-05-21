#!/usr/bin/env node
/**
 * Печатает ссылку на лендинг и команду запуска dev-сервера.
 * Использование: node scripts/print-landing-link.js subs|gpt
 */
const STORES = {
  subs: {
    name: "Subs Store (Spotify)",
    npmScript: "dev:subs",
    port: 3055,
    path: "/spotify",
    color: "\x1b[32m",
  },
  gpt: {
    name: "GPT STORE (ChatGPT)",
    npmScript: "dev:gpt",
    port: 3056,
    path: "/",
    color: "\x1b[36m",
  },
};

const key = (process.argv[2] || "subs").toLowerCase();
const store = STORES[key];

if (!store) {
  console.error("Укажите: subs или gpt");
  process.exit(1);
}

const url = `http://127.0.0.1:${store.port}${store.path}`;
const reset = "\x1b[0m";
const bold = "\x1b[1m";

console.log("");
console.log(`${store.color}${bold}  ${store.name}${reset}`);
console.log(`  Запуск:   ${bold}npm run ${store.npmScript}${reset}`);
console.log(`  Лендинг:  ${store.color}${bold}${url}${reset}`);
console.log("");
