/** Cloudflare Worker: gptplus-store.ru/__sb-auth* → GoTrue. Free plan. */
const GOTRUE = "https://cgamktdrqkxnnmnruvvq.supabase.co";

export default {
  async fetch(request) {
    const src = new URL(request.url);
    const path = src.pathname.replace(/^\/__sb-auth/, "") || "/";
    const target = GOTRUE + path + src.search;
    const headers = new Headers(request.headers);
    headers.delete("host");
    const init = { method: request.method, headers, redirect: "manual" };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }
    const res = await fetch(target, init);
    const out = new Headers(res.headers);
    out.set("X-Gpt-Auth-Proxy", "cf-worker");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
  },
};
