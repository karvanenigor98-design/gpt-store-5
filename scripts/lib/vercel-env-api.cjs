/**
 * Upsert Vercel project env via REST API (no CLI stdin).
 */
const { loadVercelToken, requireVercelToken } = require("./vercel-token.cjs");

const PROJECT = process.env.VERCEL_PROJECT_NAME || "gpt-store-5";
const TEAM_ID = process.env.VERCEL_TEAM_ID || "team_m45ERRYeGMyCf3BMXN47Ipj3";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(method, urlPath, body, attempt = 1) {
  const token = requireVercelToken();
  const url = new URL(`https://api.vercel.com${urlPath}`);
  url.searchParams.set("teamId", TEAM_ID);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text || "{}");
    } catch {
      json = { raw: text };
    }
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    if (attempt >= 4) throw err;
    await sleep(1500 * attempt);
    return api(method, urlPath, body, attempt + 1);
  }
}

async function listProjectEnv() {
  return api("GET", `/v9/projects/${encodeURIComponent(PROJECT)}/env`);
}

/**
 * @param {string} key
 * @param {string} value
 * @param {"production"|"preview"|"development"} target
 * @param {Array<{id:string,key:string,target?:string[]}>} [knownEnvs]
 */
async function upsertProjectEnv(key, value, target = "production", knownEnvs = null) {
  let envs = knownEnvs;
  if (!envs) {
    const list = await listProjectEnv();
    if (!list.ok) {
      return { ok: false, status: list.status, json: list.json, key };
    }
    envs = list.json.envs || [];
  }

  const matches = envs.filter(
    (e) => e.key === key && (!e.target || e.target.includes(target)),
  );

  for (const existing of matches) {
    const del = await api(
      "DELETE",
      `/v9/projects/${encodeURIComponent(PROJECT)}/env/${existing.id}`,
    );
    if (!del.ok && del.status !== 404) {
      return { ok: false, status: del.status, json: del.json, key, phase: "delete" };
    }
  }

  const create = await api("POST", `/v10/projects/${encodeURIComponent(PROJECT)}/env`, {
    key,
    value,
    type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted",
    target: [target],
  });

  return { ok: create.ok, status: create.status, json: create.json, key, phase: "create" };
}

/**
 * @param {string} key
 * @param {"production"|"preview"|"development"} target
 * @param {Array<{id:string,key:string,target?:string[]}>} [knownEnvs]
 */
async function deleteProjectEnv(key, target = "production", knownEnvs = null) {
  let envs = knownEnvs;
  if (!envs) {
    const list = await listProjectEnv();
    if (!list.ok) {
      return { ok: false, status: list.status, json: list.json, key, phase: "list" };
    }
    envs = list.json.envs || [];
  }

  const matches = envs.filter(
    (e) => e.key === key && (!e.target || e.target.includes(target)),
  );

  if (!matches.length) {
    return { ok: true, status: 204, json: {}, key, phase: "missing" };
  }

  for (const existing of matches) {
    const del = await api(
      "DELETE",
      `/v9/projects/${encodeURIComponent(PROJECT)}/env/${existing.id}`,
    );
    if (!del.ok && del.status !== 404) {
      return { ok: false, status: del.status, json: del.json, key, phase: "delete" };
    }
  }

  return { ok: true, status: 200, json: {}, key, phase: "delete" };
}

/**
 * Batch upsert with one env list fetch.
 * @param {Record<string, string>} entries
 * @param {"production"|"preview"|"development"} target
 */
async function syncProjectEnvs(entries, target = "production") {
  const list = await listProjectEnv();
  if (!list.ok) {
    return { ok: false, failed: Object.keys(entries), json: list.json };
  }

  let envs = list.json.envs || [];
  const failed = [];

  for (const [key, value] of Object.entries(entries)) {
    const r = await upsertProjectEnv(key, value, target, envs);
    if (!r.ok) {
      failed.push(key);
      continue;
    }
    envs = envs.filter((e) => e.key !== key || !e.target?.includes(target));
    await sleep(300);
  }

  return { ok: failed.length === 0, failed };
}

module.exports = {
  PROJECT,
  TEAM_ID,
  upsertProjectEnv,
  deleteProjectEnv,
  syncProjectEnvs,
  listProjectEnv,
};
