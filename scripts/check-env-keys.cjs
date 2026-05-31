const fs = require("fs");
const text = fs.readFileSync(".env.local", "utf8");
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  const line = text.split(/\r?\n/).find((l) => l.trim().startsWith(`${key}=`));
  if (!line) {
    console.log(key, "MISSING");
    continue;
  }
  let val = line.slice(line.indexOf("=") + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  console.log(key, val ? `len=${val.length}` : "EMPTY");
}
