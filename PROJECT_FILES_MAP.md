# PROJECT FILES MAP
## GPT STORE / Subs Store / Shared Platform

---

## 1) GPT STORE (ChatGPT Store)

### Landing + Public
- [ ] `app/(public)/page.tsx`
- [ ] `components/sections/ChatGptLandingNav.tsx`
- [ ] `components/sections/HeroSection.tsx`
- [ ] `components/sections/PricingSection.tsx`
- [ ] `components/sections/HowItWorksSection.tsx`
- [ ] `components/sections/SafetySection.tsx`
- [ ] `components/sections/WhyCheaperSection.tsx`
- [ ] `components/sections/CompareSection.tsx`
- [ ] `components/sections/ReviewsSection.tsx`
- [ ] `components/sections/FaqSection.tsx`
- [ ] `components/sections/FinalCtaSection.tsx`
- [ ] `components/sections/ChatWidget.tsx`
- [ ] `components/sections/StoreConfigAutoRefresh.tsx`
- [ ] `components/layout/LandingFooter.tsx`

### GPT Checkout
- [ ] `app/(checkout)/layout.tsx`
- [ ] `app/(checkout)/checkout/page.tsx`
- [ ] `app/(checkout)/checkout/success/page.tsx`
- [ ] `app/(checkout)/checkout/fail/page.tsx`
- [ ] `app/(checkout)/checkout/pending/page.tsx`

---

## 2) SUBS STORE (Spotify)

### Landing
- [ ] `app/(public)/spotify/page.tsx`
- [ ] `components/spotify/SpotifyNav.tsx`
- [ ] `components/spotify/SpotifyHero.tsx`
- [ ] `components/spotify/SpotifyTicker.tsx`
- [ ] `components/spotify/SpotifyHowItWorks.tsx`
- [ ] `components/spotify/SpotifySafety.tsx`
- [ ] `components/spotify/SpotifyRussia.tsx`
- [ ] `components/spotify/SpotifyWhySection.tsx`
- [ ] `components/spotify/SpotifyReviews.tsx`
- [ ] `components/spotify/SpotifyProjects.tsx`
- [ ] `components/spotify/SpotifyPricing.tsx`
- [ ] `components/spotify/SpotifyGuarantee.tsx`
- [ ] `components/spotify/SpotifyFaq.tsx`
- [ ] `components/spotify/SpotifyFinalCta.tsx`
- [ ] `components/spotify/SpotifyFooter.tsx`
- [ ] `lib/content/spotify.ts`

### Spotify Checkout
- [ ] `app/(checkout)/checkout/spotify/layout.tsx`
- [ ] `app/(checkout)/checkout/spotify/page.tsx`
- [ ] `app/(checkout)/checkout/spotify/SpotifyCheckoutFlow.tsx`
- [ ] `app/api/spotify/order/route.ts`

---

## 3) SHARED PLATFORM (Multi-site Core)

### Multi-site Core
- [ ] `lib/sites.ts`
- [ ] `lib/store-config.ts`
- [ ] `app/api/public/store-config/route.ts`
- [ ] `types/database.ts`

### Auth
- [ ] `app/(auth)/login/page.tsx`
- [ ] `app/(auth)/register/page.tsx`
- [ ] `app/(auth)/callback/page.tsx`
- [ ] `app/(auth)/forgot-password/page.tsx`
- [ ] `app/(auth)/verify-email/page.tsx`
- [ ] `app/(auth)/reset-password/page.tsx`
- [ ] `app/(auth)/reset-password/update/page.tsx`
- [ ] `app/auth/callback/route.ts`
- [ ] `app/api/auth/reset-password/route.ts`
- [ ] `app/api/auth/post-auth-sync/route.ts`
- [ ] `app/api/auth/sync-role/route.ts`
- [ ] `app/api/auth/dev-login/route.ts`
- [ ] `app/api/auth/signout/route.ts`
- [ ] `lib/auth/anchorRoles.ts`
- [ ] `lib/auth/normalizeEmail.ts`
- [ ] `lib/auth/postLoginPath.ts`
- [ ] `lib/auth/requireAdminPage.ts`
- [ ] `lib/auth/resolveRole.ts`
- [ ] `lib/auth/server-role.ts`
- [ ] `lib/auth/staffPeer.ts`
- [ ] `lib/auth/staffRoleMerge.ts`
- [ ] `lib/auth/superAdmin.ts`
- [ ] `lib/auth/syncProfileRole.ts`
- [ ] `middleware.ts`

### User Dashboard / Cabinet
- [ ] `app/(dashboard)/layout.tsx`
- [ ] `app/(dashboard)/dashboard/page.tsx`
- [ ] `app/(dashboard)/dashboard/orders/page.tsx`
- [ ] `app/(dashboard)/dashboard/chat/page.tsx`
- [ ] `app/(dashboard)/dashboard/profile/page.tsx`
- [ ] `app/(dashboard)/cabinet/page.tsx`
- [ ] `components/cabinet/OrderCard.tsx`
- [ ] `components/cabinet/StatusBadge.tsx`
- [ ] `components/cabinet/MessageThread.tsx`

### Admin + Operator
- [ ] `app/(admin)/layout.tsx`
- [ ] `app/(admin)/admin/page.tsx`
- [ ] `app/(admin)/admin/sites/page.tsx`
- [ ] `app/(admin)/admin/orders/page.tsx`
- [ ] `app/(admin)/admin/clients/page.tsx`
- [ ] `app/(admin)/admin/users/page.tsx`
- [ ] `app/(admin)/admin/chat/page.tsx`
- [ ] `app/(admin)/admin/notifications/page.tsx`
- [ ] `app/(admin)/admin/promocodes/page.tsx`
- [ ] `app/(admin)/admin/discounts/page.tsx`
- [ ] `app/(admin)/admin/reviews/page.tsx`
- [ ] `app/(admin)/admin/settings/page.tsx`
- [ ] `app/(operator)/layout.tsx`
- [ ] `app/(operator)/operator/page.tsx`
- [ ] `app/(operator)/operator/orders/page.tsx`
- [ ] `app/(operator)/operator/clients/page.tsx`
- [ ] `app/(operator)/operator/chat/page.tsx`
- [ ] `components/admin/AdminAlertsBar.tsx`
- [ ] `components/admin/OrderDrawer.tsx`
- [ ] `components/admin/OrderStatusSelect.tsx`
- [ ] `components/admin/OrdersTable.tsx`
- [ ] `components/admin/SiteSwitcher.tsx`

### Chat System
- [ ] `app/api/chat/route.ts`
- [ ] `app/api/chat/rooms/route.ts`
- [ ] `app/api/chat/messages/route.ts`
- [ ] `app/api/chat/unread/route.ts`
- [ ] `app/api/chat/attachment/route.ts`
- [ ] `app/api/chat/ai/route.ts`
- [ ] `app/api/chat/auto-reply/route.ts`
- [ ] `app/api/chat/staff/session/route.ts`
- [ ] `app/api/chat/operator/guest/session/route.ts`
- [ ] `app/api/chat/operator/guest/messages/route.ts`
- [ ] `components/chat/AIChat.tsx`
- [ ] `components/chat/ChatWindow.tsx`
- [ ] `components/chat/OperatorChat.tsx`
- [ ] `components/chat/GuestOperatorChat.tsx`
- [ ] `components/chat/RoomList.tsx`
- [ ] `lib/chat/autoResponder.ts`
- [ ] `lib/chat/messageSender.ts`
- [ ] `lib/chat/scriptedFaq.ts`

### Orders / Payments
- [ ] `app/api/payments/pally/create/route.ts`
- [ ] `app/api/payments/pally/webhook/route.ts`
- [ ] `app/api/payments/crypto/create/route.ts`
- [ ] `app/api/payments/crypto/webhook/route.ts`
- [ ] `lib/payments/pally.ts`
- [ ] `lib/payments/crypto.ts`

### Reviews / Notifications / SEO / Legal
- [ ] `app/api/reviews/sync/route.ts`
- [ ] `app/api/reviews/webhook/route.ts`
- [ ] `lib/reviews/publicReviews.ts`
- [ ] `lib/telegram/notifications.ts`
- [ ] `components/analytics/YandexMetrika.tsx`
- [ ] `app/sitemap.ts`
- [ ] `app/robots.ts`
- [ ] `app/(public)/privacy/page.tsx`
- [ ] `app/(public)/terms/page.tsx`

---

## 4) ROOT PROJECT FILES

- [ ] `package.json`
- [ ] `package-lock.json`
- [ ] `tsconfig.json`
- [ ] `next.config.mjs`
- [ ] `tailwind.config.ts`
- [ ] `postcss.config.mjs`
- [ ] `vercel.json`
- [ ] `.eslintrc.json`
- [ ] `README.md`
- [ ] `SETUP.md`
- [ ] `LAUNCH_GUIDE.md`
- [ ] `HANDOVER.md`

---

If needed, this file can be expanded into a full inventory of every source file (`app/**`, `components/**`, `lib/**`, `types/**`, `data/**`) in a separate machine-readable format.
