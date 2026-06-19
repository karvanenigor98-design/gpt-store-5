(async () => {
  const hosts = ["gptplus-store.ru", "spotify-store.ru", "gpt-store-5.vercel.app"];
  for (const host of hosts) {
    const html = await (await fetch(`https://${host}/`)).text();
    const links = [...html.matchAll(/<link[^>]+icon[^>]*>/gi)].map((m) => m[0]);
    console.log("\n===", host, "===");
    links.forEach((l) => console.log(l));
    const abs = links.filter((l) => l.includes("https://")).length;
    console.log("absolute icon links:", abs, "/", links.length);
    for (const p of ["/favicon.ico", "/icons/gpt/icon.svg", "/icons/gpt/icon-120.png"]) {
      const r = await fetch(`https://${host}${p}`);
      console.log(p, r.status, r.headers.get("content-type"));
    }
  }
})();
