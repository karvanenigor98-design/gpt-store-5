/**
 * OPERATOR_EMAIL на Vercel (production).
 * node scripts/set-operator-email-vercel.cjs a49584377@gmail.com
 */
const { syncProjectEnvs } = require("./lib/vercel-env-api.cjs");

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/set-operator-email-vercel.cjs <email>");
  process.exit(1);
}

(async () => {
  const r = await syncProjectEnvs({ OPERATOR_EMAIL: email }, "production");
  if (r.failed?.length) {
    console.error("FAIL:", r.failed);
    process.exit(1);
  }
  console.log("ok OPERATOR_EMAIL → production:", email);
  console.log("Redeploy: node scripts/vercel-redeploy-prod.cjs");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
