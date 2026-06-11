/**
 * Smoke checks for:
 * 1) GPT hero promo -> plus-new / 1590 / 1990 / checkout plan
 * 2) Staff mark-all-read targets all sites present in notification list
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const { HERO_PROMO_CONFIG } = await import(
  new URL("../lib/landing/hero-promo-config.ts", import.meta.url).href
);
const { resolveGptHeroPromoOffer, resolveSpotifyHeroPromoOffer } = await import(
  new URL("../lib/landing/resolve-hero-promo-offer.ts", import.meta.url).href
);
const { PLUS_PLANS_NEW } = await import(new URL("../lib/chatgpt-data.ts", import.meta.url).href);
const { SPOTIFY_PLANS } = await import(new URL("../lib/content/spotify.ts", import.meta.url).href);
const { resolveGptCheckoutPlan } = await import(
  new URL("../lib/checkout/resolve-gpt-checkout.ts", import.meta.url).href
);

function assertIncludes(fileRel, needle, label) {
  const text = fs.readFileSync(path.join(root, fileRel), "utf8");
  assert(text.includes(needle), `${label}: expected ${needle} in ${fileRel}`);
}

// --- Hero promo GPT ---
const gptCfg = HERO_PROMO_CONFIG.gpt;
assert.equal(gptCfg.featuredPlanId, "plus-new", "GPT featured plan");
assert.equal(gptCfg.promoSalePrice, 1590, "GPT promo sale price");
assert.equal(gptCfg.promoOriginalPrice, 1990, "GPT promo original price");

const gptOffer = resolveGptHeroPromoOffer(
  PLUS_PLANS_NEW.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    currency: p.currency,
    period: p.period,
    productId: p.productId,
  })),
  [],
  gptCfg,
);

assert.ok(gptOffer, "GPT hero offer should resolve");
assert.equal(gptOffer.planId, "plus-new");
assert.match(gptOffer.planName, /новых аккаунт/i);
assert.equal(gptOffer.salePrice, 1590);
assert.equal(gptOffer.originalPrice, 1990);
assert.equal(gptOffer.checkoutHref, "/checkout?plan=plus-new");
assert.match(gptOffer.ctaLabel, /1\s?590/);

// Spotify unchanged
const spotifyCfg = HERO_PROMO_CONFIG.spotify;
assert.equal(spotifyCfg.featuredPlanId, "spotify-ind-3m");
const spotifyOffer = resolveSpotifyHeroPromoOffer(
  SPOTIFY_PLANS.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    oldPrice: p.oldPrice,
    originalPrice: p.originalPrice,
    durationMonths: p.durationMonths,
    ctaText: p.ctaText,
  })),
  [],
  spotifyCfg,
);
assert.ok(spotifyOffer);
assert.equal(spotifyOffer.planId, "spotify-ind-3m");
assert.equal(spotifyOffer.salePrice, 1090);

const checkout = await resolveGptCheckoutPlan("plus-new");
assert.equal(checkout.ok, true, "checkout plan plus-new");
assert.equal(checkout.resolved.plan.id, "plus-new");
assert.equal(checkout.resolved.plan.name, "Для новых аккаунтов");
assert.equal(checkout.resolved.finalPrice, 1590);

const checkoutPopular = await resolveGptCheckoutPlan("plus-std");
assert.equal(checkoutPopular.ok, true);
assert.equal(checkoutPopular.resolved.finalPrice, 2190);

// --- Notifications mark-all sites ---
assertIncludes(
  "hooks/useStaffNotifications.ts",
  "const fromItems = uniqueSiteSlugs(snapshot).filter((s) => accessibleSites.includes(s));",
  "staff mark-all uses sites from visible notifications",
);
assertIncludes(
  "hooks/useStaffNotifications.ts",
  "refreshStaffNavBadges();",
  "staff mark-all refreshes nav badges",
);
assertIncludes(
  "hooks/useClientNotifications.ts",
  "const snapshot = items;",
  "client mark-all keeps snapshot for rollback",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      gptHero: {
        planId: gptOffer.planId,
        planName: gptOffer.planName,
        salePrice: gptOffer.salePrice,
        originalPrice: gptOffer.originalPrice,
        checkoutHref: gptOffer.checkoutHref,
        ctaLabel: gptOffer.ctaLabel,
      },
      spotifyHero: {
        planId: spotifyOffer.planId,
        salePrice: spotifyOffer.salePrice,
      },
      checkout: {
        planId: checkout.resolved.plan.id,
        planName: checkout.resolved.plan.name,
        finalPrice: checkout.resolved.finalPrice,
      },
    },
    null,
    2,
  ),
);
