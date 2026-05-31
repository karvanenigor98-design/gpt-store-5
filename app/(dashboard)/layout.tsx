import { Suspense } from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardNav, DashboardMobileNav } from "./DashboardNav";
import { ClientNotificationsBar } from "@/components/dashboard/ClientNotificationsBar";
import { DashboardSiteLogo, DashboardSiteHeaderTitle } from "./DashboardSiteBranding";
import { hasSiteMembership } from "@/lib/auth/siteMembership";
import { resolveCustomerSiteSlug } from "@/lib/auth/resolveCustomerSiteSlug";
import { isSiteUiLoggedOut, type SiteSlug } from "@/lib/auth/siteUiSession";
import { getSiteBySlug } from "@/lib/sites";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import { ReferralCapture } from "@/components/referrals/ReferralCapture";

export const dynamic = "force-dynamic";

function dashboardLayoutError(message?: string) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-xl font-bold text-gray-900">Не удалось открыть кабинет</h1>
        <p className="mt-3 text-sm text-gray-600">
          {message ??
            "Обновите страницу или войдите заново. Если ошибка повторяется — напишите в поддержку."}
        </p>
        <Link
          href="/login?site=gpt-store"
          className="mt-6 inline-block rounded-xl bg-[#10a37f] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          На страницу входа
        </Link>
      </div>
    </div>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
  const cookieStore = await cookies();
  const headersList = await headers();
  const invokePath = headersList.get("x-invoke-pathname") ?? "";
  const invokeSearch = headersList.get("x-invoke-search") ?? "";
  const urlSite = headersList.get("x-site-slug");
  const siteSlug: SiteSlug = await resolveCustomerSiteSlug({
    siteParam: urlSite === "subs-store" || urlSite === "gpt-store" ? urlSite : null,
    pathname: invokePath || "/dashboard",
  });
  const isCabinetPath =
    invokePath.startsWith("/dashboard") || invokePath.startsWith("/cabinet");
  const returnPath =
    invokePath && isCabinetPath
      ? `${invokePath}${invokeSearch}`
      : `/dashboard?site=${siteSlug}`;
  const returnUrl = encodeURIComponent(returnPath);

  let bundle;
  try {
    bundle = await createSiteSessionClient(siteSlug);
  } catch {
    redirect(`/login?returnUrl=${returnUrl}&site=${siteSlug}&reason=supabase_env_missing`);
  }

  const supabase = bundle.browserLike;
  let user;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    redirect(`/login?returnUrl=${returnUrl}&site=${siteSlug}&reason=auth_session_error`);
  }

  if (!user || isSiteUiLoggedOut(siteSlug, cookieStore)) {
    redirect(`/login?returnUrl=${returnUrl}&site=${siteSlug}`);
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

        <Suspense fallback={<nav className="hidden flex-1 md:flex" aria-hidden />}>
          <DashboardNav defaultSiteSlug={siteSlug} />
        </Suspense>

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
              isSubsShell ? "border-white/10 bg-[#111111]" : "border-gray-200 bg-white/75 backdrop-blur-md",
            )}
          >
            <Suspense fallback={null}>
              <ClientNotificationsBar siteSlug={siteSlug} />
            </Suspense>
          </header>
        )}
        {/* Mobile header */}
        <header
          className={cn(
            "flex h-14 items-center justify-between px-4 md:hidden",
            useDarkCabinetShell ? "border-b border-white/10 bg-[#111111]" : "border-b border-gray-200 bg-white/75 backdrop-blur-md"
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
            {(isSubsShell || isGptShell) && (
              <Suspense fallback={null}>
                <ClientNotificationsBar siteSlug={siteSlug} />
              </Suspense>
            )}
          </div>
        </header>
        <main
          className={cn(
            "min-w-0 flex-1 overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6 lg:p-8",
            useDarkCabinetShell ? "bg-[#0a0a0a]" : "bg-gray-50",
          )}
        >
          <Suspense fallback={null}>
            <ReferralCapture siteSlug={siteSlug} />
          </Suspense>
          {children}
        </main>
      </div>
      <Suspense fallback={null}>
        <DashboardMobileNav defaultSiteSlug={siteSlug} />
      </Suspense>
    </div>
  );
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("[dashboard/layout]", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("gpt_auth_env_missing") || msg.includes("GPT Supabase env invalid")) {
      return dashboardLayoutError(
        "На сервере не настроен Supabase (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY). Обратитесь к администратору сайта.",
      );
    }
    return dashboardLayoutError();
  }
}
