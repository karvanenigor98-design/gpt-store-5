const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const allDistDirs = [".next", ".next-subs", ".next-gpt", path.join("app", ".next")];

const only = (process.env.NEXT_DEV_DIST_DIR || "").trim();
const targets = only
  ? [path.join(projectRoot, only)]
  : allDistDirs.map((d) => path.join(projectRoot, d));

for (const target of targets) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

if (only) {
  console.log(`Cleaned Next cache: ${only}`);
} else {
  console.log("Cleaned Next cache folders (.next, .next-subs, .next-gpt).");
}
