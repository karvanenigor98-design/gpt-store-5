(async () => {
  const hosts = ["gptplus-store.ru", "spotify-store.ru"];
  for (const host of hosts) {
    const html = await (await fetch(`https://${host}/`)).text();
    const links = [...html.matchAll(/<link[^>]+icon[^>]*>/gi)].map((m) => m[0]);
    console.log("\n===", host, "===");
    links.forEach((l) => console.log(l));
    for (const p of ["/favicon.ico", "/icons/gpt/favicon.ico", "/icons/spotify/favicon.ico", "/icons/gpt/icon-192.png"]) {
      const r = await fetch(`https://${host}${p}`);
      console.log(p, r.status, r.headers.get("content-type"), r.headers.get("content-length"));
    }
  }
})();
