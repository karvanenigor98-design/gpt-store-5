/**
 * Static regression checks for GPT/SPOTIFY STORE stabilization fixes.
 * Exit 0 = pass, 1 = fail.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const fails = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assertIncludes(rel, needle, label) {
  const src = read(rel);
  if (!src.includes(needle)) fails.push(`FAIL: ${label} — missing in ${rel}: ${needle}`);
}

function assertNotIncludes(rel, needle, label) {
  const src = read(rel);
  if (src.includes(needle)) fails.push(`FAIL: ${label} — must not appear in ${rel}: ${needle}`);
}

function assertFile(rel) {
  if (!fs.existsSync(path.join(root, rel))) fails.push(`FAIL: missing file ${rel}`);
}

// Hero
assertIncludes("components/spotify/SpotifyHero.tsx", "SpotifyPromoPlayerCard", "Spotify hero visual");
assertIncludes("components/sections/HeroSection.tsx", "HeroPromoOfferCard", "GPT hero visual");
assertIncludes("hooks/use-hero-promo-offer.ts", "Layout must never collapse", "hero offer after deadline");

// Reviews / Anna
assertNotIncludes("components/spotify/SpotifyReviews.tsx", "featuredTitle", "Anna h2 bug");
assertIncludes("lib/reviews/spotifyPublicReviews.ts", "Never fall back to hardcoded mock", "no mock reviews");
assertIncludes("lib/landing/spotify-landing-static-payload.ts", "reviews: []", "static reviews empty");

// Promo
assertFile("lib/promocodes/promo-resolve.ts");
assertIncludes("lib/checkout/resolve-gpt-checkout.ts", "resolvePromoForPlan", "GPT promo resolve");
assertIncludes("lib/promocodes/db-promo.ts", "site_id.eq.gpt-store", "GPT promo site filter");

// Chat sort / search
assertFile("lib/chat/sort-staff-rooms.ts");
assertIncludes("app/api/chat/rooms/route.ts", "sortStaffChatRooms", "GPT rooms sort");
assertIncludes("app/api/admin/subs-store/chat/rooms/route.ts", "sortStaffChatRooms", "Subs rooms sort");
assertIncludes("app/api/admin/subs-store/chat/rooms/route.ts", "orderEmailsByUser", "Subs account_email search");
assertIncludes("app/api/chat/rooms/route.ts", "account_email", "GPT account_email search");

// Chat button / order id
assertIncludes("components/admin/StaffOrderChatLink.tsx", "Чат", "chat button always");
assertNotIncludes("components/admin/StaffOrderChatLink.tsx", "text-gray-400", "no dash fallback for chat");
assertIncludes("components/admin/OrderIdCell.tsx", "md:inline md:whitespace-nowrap", "full ID desktop");

// Notifications
assertIncludes("lib/notifications/staff-events.ts", "refreshExistingChat", "notif refresh");
assertIncludes("lib/notifications/client-chat-alert.ts", "SPOTIFY STORE", "store label in alert");
assertIncludes("app/(admin)/admin/notifications/page.tsx", "Все магазины", "site filter UI");

// Operator stability
assertIncludes("components/admin/OperatorSidebar.tsx", "/operator/reviews?status=pending", "operator reviews nav");
assertNotIncludes("components/admin/OperatorSidebar.tsx", "router.replace", "no duplicate site sync");
assertIncludes("lib/auth/requireAdminPage.ts", "/operator?site=gpt-store", "no bare /operator redirect");
assertIncludes("lib/auth/syncStaffSiteMemberships.ts", "clearStaffSiteMembershipsInGpt", "demotion clears memberships");

// Perf
assertIncludes("app/api/admin/chat/messages/route.ts", ".limit(1000)", "messages limit");
assertNotIncludes("components/chat/RoomList.tsx", "refreshStaffNavBadges", "no badge storm from RoomList");

// Migrations
assertFile("supabase/migrations/030_staff_ops_indexes.sql");
assertFile("supabase/subs-store-migrations/009_staff_ops_indexes.sql");

if (fails.length) {
  console.error(fails.join("\n"));
  process.exit(1);
}
console.log("verify-stability-regression: OK (" + [
  "hero",
  "reviews",
  "promo",
  "chat",
  "notif",
  "operator",
  "perf",
  "sql",
].join(", ") + ")");
process.exit(0);
