const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.local");
const text = fs.readFileSync(envPath, "utf8");
for (const line of text.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) continue;
  let val = trimmed.slice("NEXT_PUBLIC_SUPABASE_URL=".length).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  console.log("local NEXT_PUBLIC_SUPABASE_URL ok:", /\.supabase\.co/i.test(val), "host:", (() => {
    try {
      return new URL(val).hostname;
    } catch {
      return "INVALID";
    }
  })());
  process.exit(0);
}
console.error("NEXT_PUBLIC_SUPABASE_URL not found in .env.local");
process.exit(1);
