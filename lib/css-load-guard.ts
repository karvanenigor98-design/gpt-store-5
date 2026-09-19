/** Inline CSS + script: must live in HTML, not a JS chunk (chunks 404 with stale HTML).
 *  Do NOT inline Tailwind utilities here — they override `md:flex-row` and shove operator/admin content down. */

export const CSS_LOAD_GUARD_STYLE = `
#css-fail-banner{display:none;position:fixed;z-index:2147483647;left:0;right:0;top:0;padding:12px 16px;background:#111827;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)}
#css-fail-banner button{margin-left:12px;padding:6px 12px;border:0;border-radius:8px;background:#10a37f;color:#fff;font-weight:600;cursor:pointer}
`.trim();

export const CSS_LOAD_GUARD_SCRIPT = `
(function(){
  var KEY="gpt_css_reload";
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
  function sheetsOk(){
    var links=document.querySelectorAll('link[rel="stylesheet"][href*="_next/static/css"]');
    if(!links.length) return hiddenWorks();
    for(var i=0;i<links.length;i++){
      if(links[i].sheet) return true;
    }
    return false;
  }
  function showBanner(){
    var b=document.getElementById("css-fail-banner");
    if(b) b.style.display="block";
    var btn=document.getElementById("css-fail-reload");
    if(btn && !btn.getAttribute("data-bound")){
      btn.setAttribute("data-bound","1");
      btn.addEventListener("click",function(){
        try{sessionStorage.removeItem(KEY);}catch(e){}
        location.reload();
      });
    }
  }
  function stripBust(){
    try{
      var u=new URL(location.href);
      if(!u.searchParams.has("_css")) return;
      u.searchParams.delete("_css");
      history.replaceState(null,"",u.pathname+u.search+u.hash);
    }catch(e){}
  }
  function run(){
    if(sheetsOk() && hiddenWorks()){
      try{sessionStorage.removeItem(KEY);}catch(e){}
      stripBust();
      return;
    }
    var tried=false;
    try{tried=sessionStorage.getItem(KEY)==="1";}catch(e){}
    if(!tried){
      try{sessionStorage.setItem(KEY,"1");}catch(e){}
      try{
        var u=new URL(location.href);
        u.searchParams.set("_css", String(Date.now()));
        location.replace(u.toString());
      }catch(e){
        location.reload();
      }
      return;
    }
    showBanner();
  }
  if(document.readyState==="complete") run();
  else window.addEventListener("load", run);
})();
`.trim();
