/** Плавный скролл к блоку тарифов на лендинге /spotify. */
export function scrollToSpotifyPricing(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById("pricing");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  window.location.hash = "pricing";
}
