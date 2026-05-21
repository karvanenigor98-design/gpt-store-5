#!/usr/bin/env node
const bold = "\x1b[1m";
const reset = "\x1b[0m";
const cyan = "\x1b[36m";
const green = "\x1b[32m";

console.log("");
console.log(`${bold}  Два лендинга — запускайте в двух терминалах:${reset}`);
console.log("");
console.log(`  ${cyan}${bold}GPT STORE (ChatGPT)${reset}`);
console.log(`    npm run dev:gpt`);
console.log(`    ${cyan}http://127.0.0.1:3056/${reset}`);
console.log("");
console.log(`  ${green}${bold}Subs Store (Spotify)${reset}`);
console.log(`    npm run dev:subs`);
console.log(`    ${green}http://127.0.0.1:3055/spotify${reset}`);
console.log(`    (корень :3055/ редиректит на /spotify)`);
console.log("");
console.log(`  Или одной командой: ${bold}npm run dev:both${reset}`);
console.log("");
