"use strict";

const fs = require("fs");
const path = require("path");

const distDir = process.env.NEXT_DEV_DIST_DIR?.trim() || ".next";
const cssDir = path.join(process.cwd(), distDir, "static", "css");
const outFile = path.join(process.cwd(), "public", "gpt-app.css");

if (!fs.existsSync(cssDir)) {
  console.warn("copy-css-fallback: skip, missing", cssDir);
  process.exit(0);
}

const files = fs
  .readdirSync(cssDir)
  .filter((name) => name.endsWith(".css"))
  .sort();

if (!files.length) {
  console.warn("copy-css-fallback: no css in", cssDir);
  process.exit(0);
}

const css = files
  .map((name) => fs.readFileSync(path.join(cssDir, name), "utf8"))
  .join("\n");

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(
  outFile,
  `${css}\n.css-asset-ok{display:none!important}\n`,
  "utf8",
);
console.log(
  "copy-css-fallback: wrote",
  outFile,
  "from",
  files.join(","),
  fs.statSync(outFile).size,
  "bytes",
);
