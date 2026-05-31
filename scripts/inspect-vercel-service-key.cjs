const { requireVercelToken } = require("./lib/vercel-token.cjs");

const TEAM = "team_m45ERRYeGMyCf3BMXN47Ipj3";
const PROJECT = "gpt-store-5";
const KEY = "SUPABASE_SERVICE_ROLE_KEY";

async function main() {
  const token = requireVercelToken();
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${PROJECT}/env?teamId=${TEAM}&decrypt=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  const matches = (data.envs || []).filter((e) => e.key === KEY);
  console.log(`entries=${matches.length}`);
  for (const e of matches) {
    const val = e.value || "";
    console.log(
      JSON.stringify({
        id: e.id,
        type: e.type,
        target: e.target,
        len: val.length,
        starts: val.slice(0, 20),
        ends: val.slice(-20),
      }),
    );
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
