const { requireVercelToken } = require("./lib/vercel-token.cjs");

async function main() {
  const token = requireVercelToken();
  const team = "team_m45ERRYeGMyCf3BMXN47Ipj3";
  const r = await fetch(
    `https://api.vercel.com/v9/projects/gpt-store-5/env?teamId=${team}&decrypt=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await r.json();
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  for (const k of keys) {
    const e = data.envs?.find((x) => x.key === k && x.target?.includes("production"));
    const val = e?.value ?? "";
    const okSupabase = /\.supabase\.co/i.test(val);
    console.log(
      k,
      val ? `${val.slice(0, 55)}${val.length > 55 ? "…" : ""}` : "EMPTY",
      k.includes("URL") ? `(supabase.co: ${okSupabase})` : `(len: ${val.length})`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
