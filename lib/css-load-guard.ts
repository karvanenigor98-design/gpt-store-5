/** Inline CSS must live in HTML. Never wait for window.load — hung /_next/static
 *  in Yandex never fires load, so the page stays unstyled. Never auto-reload. */

export const CSS_LOAD_GUARD_STYLE = `
#css-fail-banner{display:none;position:fixed;z-index:2147483647;left:0;right:0;top:0;padding:12px 16px;background:#111827;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)}
#css-fail-banner button{margin-left:12px;padding:6px 12px;border:0;border-radius:8px;background:#10a37f;color:#fff;font-weight:600;cursor:pointer}
html,body{margin:0;background:#e9f8f2;color:#111827;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
#gpt-landing{min-height:100vh;background:#e9f8f2;color:#111827}
#gpt-landing header{position:sticky;top:0;z-index:50;background:rgba(233,248,242,.95);border-bottom:1px solid rgba(0,0,0,.08)}
#gpt-landing header>div{display:flex;align-items:center;justify-content:space-between;gap:12px;height:56px;max-width:72rem;margin:0 auto;padding:0 16px}
#gpt-landing main{padding:24px 16px 72px}
#gpt-landing h1{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800;line-height:1.15;margin:12px 0}
#gpt-landing h2{font-size:1.35rem;font-weight:700;margin:16px 0 8px}
#gpt-landing a{color:#0f766e}
#gpt-auth{min-height:100vh;display:flex;flex-direction:column;background:#e9f8f2;color:#111827}
#gpt-auth header{display:flex;align-items:center;height:56px;padding:0 24px;border-bottom:1px solid rgba(0,0,0,.08);background:#fff}
#gpt-auth main{flex:1;display:flex;align-items:center;justify-content:center;padding:48px 16px}
#gpt-auth main>div{width:100%;max-width:28rem;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:24px;box-shadow:0 12px 36px rgba(15,23,42,.08)}
#gpt-auth footer{text-align:center;color:#6b7280;padding:16px;font-size:12px}
#gpt-auth input{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.14);border-radius:12px;padding:10px 12px;font-size:14px}
#gpt-auth button[type=submit]{width:100%;background:#10a37f;color:#fff;border:0;border-radius:12px;padding:12px;font-weight:600;font-size:14px}
#gpt-landing article{background:#fff;border-radius:1.75rem;padding:1.5rem;box-shadow:0 12px 40px rgba(16,163,127,.08);margin:0 0 1rem}
#gpt-landing ul{list-style:none;padding:0;margin:1rem 0}
#gpt-landing li{display:flex;align-items:center;gap:.75rem;margin:.45rem 0;color:#6b7280}
#gpt-landing a[href="#plans"]{display:inline-flex;align-items:center;gap:.5rem;background:#10a37f;color:#fff!important;border-radius:999px;padding:.85rem 2rem;font-weight:600;text-decoration:none;margin-top:1rem}
#gpt-landing #plans article{border:1px solid rgba(0,0,0,.08);border-radius:1rem;padding:1rem}
#gpt-landing button,#gpt-landing a[href*="checkout"],#gpt-landing a[href*="login"]{border-radius:.75rem}
@media (min-width:1024px){#gpt-landing #hero .grid{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem}#gpt-landing #plans .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}}
`.trim();

const CSS_FALLBACK_HREF = `/gpt-app.css?v=${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || "2"}`;

export const CSS_LOAD_GUARD_SCRIPT = `
(function(){
  var FALLBACK=${JSON.stringify(CSS_FALLBACK_HREF)};
  function hiddenWorks(){
    var d=document.createElement("div");
    d.className="css-asset-ok";
    d.setAttribute("aria-hidden","true");
    document.documentElement.appendChild(d);
    var ok=false;
    try{ok=getComputedStyle(d).display==="none";}catch(e){}
    d.remove();
    return ok;
  }
  function showBanner(){
    var b=document.getElementById("css-fail-banner");
    if(b) b.style.display="block";
    var btn=document.getElementById("css-fail-reload");
    if(btn && !btn.getAttribute("data-bound")){
      btn.setAttribute("data-bound","1");
      btn.addEventListener("click",function(){ location.reload(); });
    }
  }
  function injectFallback(){
    if(document.querySelector("link[data-gpt-app]")) return;
    var l=document.createElement("link");
    l.rel="stylesheet";
    l.href=FALLBACK;
    l.setAttribute("data-gpt-app","1");
    document.head.appendChild(l);
  }
  function run(){
    if(hiddenWorks()) return;
    injectFallback();
    setTimeout(function(){ if(!hiddenWorks()) showBanner(); }, 1200);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", function(){ setTimeout(run, 400); });
  else setTimeout(run, 400);
})();
`.trim();
