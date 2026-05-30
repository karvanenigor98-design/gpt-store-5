const https = require("https");
const { loadVercelToken } = require("./lib/vercel-token.cjs");

const TEAM = process.env.VERCEL_TEAM_ID || "team_m45ERRYeGMyCf3BMXN47Ipj3";
const PROJECT = process.env.VERCEL_PROJECT_NAME || "gpt-store-5";
const REF = process.argv[2] || "main";

function req(method, apiPath, body) {
  const token = loadVercelToken();
  if (!token) throw new Error("No VERCEL_TOKEN");

  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request(
      {
        hostname: "api.vercel.com",
        path: apiPath,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          let json;
          try {
            json = JSON.parse(d || "{}");
          } catch {
            json = { raw: d };
          }
          if (res.statusCode >= 400) {
            reject(new Error(`${res.statusCode} ${apiPath}: ${d}`));
          } else resolve(json);
        });
      },
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  console.log("Deploying", PROJECT, "ref", REF, "→ production");

  const deployment = await req("POST", `/v13/deployments?teamId=${TEAM}`, {
    name: PROJECT,
    target: "production",
    gitSource: {
      type: "github",
      org: "buzanovnikita30-hash",
      repo: "gpt-store-5",
      ref: REF,
    },
  });

  console.log("deployment:", deployment.id || deployment.uid);
  console.log("url:", deployment.url);
  console.log("inspect:", deployment.inspectorUrl || `https://vercel.com/${TEAM}/${PROJECT}`);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
