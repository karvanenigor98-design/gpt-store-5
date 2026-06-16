#!/usr/bin/env node
/**
 * Ссылки для Pally → магазин → «Ссылки».
 * Логика совпадает с lib/payments/pally.ts (buildPallyRedirectUrls + getServerSiteOriginBySlug).
 */
"use strict";

const GPT_ORIGIN = (
  process.env.GPT_SITE_URL ||
  process.env.NEXT_PUBLIC_GPT_SITE_URL ||
  "https://gptplus-store.ru"
).replace(/\/$/, "");

const SPOTIFY_ORIGIN = (
  process.env.SPOTIFY_SITE_URL ||
  process.env.NEXT_PUBLIC_SPOTIFY_SITE_URL ||
  "https://spotify-store.ru"
).replace(/\/$/, "");

function cabinetUrls(origin, site) {
  const base = origin.replace(/\/$/, "");
  return {
    shopUrl: `${base}/`,
    successUrl: `${base}/checkout/success`,
    failUrl: `${base}/checkout/fail`,
    resultUrl: `${base}/api/payments/pally/webhook`,
  };
}

function printBlock(title, shopEnvHint, urls) {
  console.log(`\n=== ${title} (${shopEnvHint}) ===\n`);
  console.log("URL магазина:", urls.shopUrl);
  console.log("Success URL:", urls.successUrl);
  console.log("Fail URL:", urls.failUrl);
  console.log("Result URL (webhook):", urls.resultUrl);
  console.log("Refund URL: (пусто)");
  console.log("Chargeback URL: (пусто)");
}

printBlock("GPT STORE", "PALLY_SHOP_ID / PALLY_SHOP_ID_GPT", cabinetUrls(GPT_ORIGIN, "gpt-store"));
printBlock("SPOTIFY STORE", "PALLY_SHOP_ID_SUBS", cabinetUrls(SPOTIFY_ORIGIN, "subs-store"));
console.log("\nВажно: URL в Pally должны совпадать символ-в-символ с API (иначе url_not_allowed).\n");
