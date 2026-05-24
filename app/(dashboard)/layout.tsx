import { Suspense } from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardNav, DashboardMobileNav } from "./DashboardNav";
import { ClientNotificationsBar } from "@/components/dashboard/ClientNotificationsBar";
import { resolveCabinetServerRole } from "@/lib/auth/server-role";
import { DashboardSiteLogo, DashboardSiteHeaderTitle } from "./DashboardSiteBranding";
import { hasSiteMembership } from "@/lib/auth/siteMembership";
import { resolveCustomerSiteSlug } from "@/lib/auth/resolveCustomerSiteSlug";
import { isSiteUiLoggedOut, type SiteSlug } from "@/lib/auth/siteUiSession";
import { getSiteBySlug } from "@/lib/sites";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import { ReferralCapture } from "@/components/referrals/ReferralCapture";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const headersList = await headers();
  const invokePath = headersList.get("x-invoke-pathname") ?? "";
  const urlSite = headersList.get("x-site-slug");
  const cookieSite = cookieStore.get("current_site")?.value;
  const siteSlug: SiteSlug = await resolveCustomerSiteSlug({
    siteParam:
      urlSite === "subs-store" || urlSite === "gpt-store" ? urlSite
      : cookieSite === "subs-store" || cookieSite === "gpt-store" ? cookieSite
      : null,
    pathname: invokePath || "/dashboard",
  });
  const returnUrl = encodeURIComponent(`/dashboard?site=${siteSlug}`);

  let bundle;
  try {
    bundle = await createSiteSessionClient(siteSlug);
  } catch {
    redirect(`/login?returnUrl=${returnUrl}&site=${siteSlug}&reason=subs_env_missing`);
  }

  const supabase = bundle.browserLike;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || isSiteUiLoggedOut(siteSlug, cookieStore)) {
    redirect(`/login?returnUrl=${returnUrl}&site=${siteSlug}`);
  }

  const role = await resolveCabinetServerRole(siteSlug, user);
  const isDashboardProfile =
    invokePath === "/dashboard/profile" || invokePath.startsWith("/dashboard/profile/");

  if (siteSlug === "gpt-store") {
    if (role === "admin" && !isDashboardProfile) {
      redirect("/admin");
    }
    if (role === "operator" && !isDashboardProfile) {
      redirect("/operator");
    }
  }

  // Check site membership: if user has memberships but not for this site, redirect to login
  const hasAccess = await hasSiteMembership(user.id, user.email, siteSlug);
  if (!hasAccess) {
    redirect(`/login?site=${siteSlug}&returnUrl=${returnUrl}&reason=no_membership`);
  }

  // Resolve site definition for server-side components (статический импорт — меньше гонок webpack в dev на Windows)
  const site = getSiteBySlug(siteSlug);
  const isSubsShell = siteSlug === "subs-store";
  const isGptShell = siteSlug === "gpt-store";
  const useDarkCabinetShell = isSubsShell;
  const avatarColor = site.primaryColor;
  const fallbackLetter = site.logoLetter;
  const fallbackBrand = site.brandName;
  const fallbackLandingPath = site.landingPath;

  return (
    <div className={cn("flex min-h-screen", useDarkCabinetShell ? "bg-[#0a0a0a]" : "bg-gray-50")}>
      {/* Dark Sidebar */}
      <aside className="hidden w-60 flex-col bg-[#111827] md:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <Suspense
            fallback={
              <Link href={fallbackLandingPath} className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ backgroundColor: avatarColor }}
                >
                  {fallbackLetter}
                </div>
                <span className="font-heading text-sm font-bold text-white">{fallbackBrand}</span>
              </Link>
            }
          >
            <DashboardSiteLogo defaultSiteSlug={siteSlug} />
          </Suspense>
        </div>

        <DashboardNav defaultSiteSlug={siteSlug} />

        <div className="border-t border-white/10 px-3 py-3">
          <div className="mb-3 flex items-center gap-2.5 px-3 py-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: avatarColor }}
            >
              {user.email?.[0]?.toUpperCase()}
            </div>
            <p className="truncate text-xs text-gray-400">{user.email}</p>
          </div>
          <form action={`/api/auth/signout?site=${siteSlug}`} method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut size={15} />
              Выйти
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {(isSubsShell || isGptShell) && (
          <header
            className={cn(
              "hidden h-14 items-center justify-end border-b px-6 md:flex",
              isSubsShell ? "border-white/10 bg-[#111111]" : "border-gray-200 bg-white",
            )}
          >
            <ClientNotificationsBar siteSlug={siteSlug} />
          </header>
        )}
        {/* Mobile header */}
        <header
          className={cn(
            "flex h-14 items-center justify-between px-4 md:hidden",
            useDarkCabinetShell ? "border-b border-white/10 bg-[#111111]" : "border-b border-gray-200 bg-white"
          )}
        >
          <Suspense
            fallback={
              <span
                className={cn(
                  "font-heading text-sm font-semibold",
                  useDarkCabinetShell ? "text-white" : "text-gray-900"
                )}
              >
                Кабинет
              </span>
            }
          >
            <DashboardSiteHeaderTitle defaultSiteSlug={siteSlug} />
          </Suspense>
          <div className="flex items-center gap-2">
            {(isSubsShell || isGptShell) && <ClientNotificationsBar siteSlug={siteSlug} />}
            <DashboardMobileNav defaultSiteSlug={siteSlug} />
          </div>
        </header>
        <main
          className={cn(
            "min-w-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8",
            useDarkCabinetShell && "bg-[#0a0a0a]",
          )}
        >
          <Suspense fallback={null}>
            <ReferralCapture siteSlug={siteSlug} />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
