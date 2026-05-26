const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "data", "gpt-telegram-reviews.json");
const dest = path.join(__dirname, "..", "public", "gpt-telegram-reviews.json");

if (!fs.existsSync(src)) {
  console.warn("[copy-gpt-reviews] skip: data/gpt-telegram-reviews.json not found");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("[copy-gpt-reviews] copied to public/gpt-telegram-reviews.json");
