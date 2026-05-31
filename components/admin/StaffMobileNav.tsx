"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { StaffNavBadge } from "@/components/admin/StaffNavBadge";
import { useStaffNavBadges } from "@/components/admin/useStaffNavBadges";
import { getSiteBySlug } from "@/lib/sites";
import { staffNavHref } from "@/lib/admin/staffNavHref";
import type { StaffNavItem } from "@/lib/admin/staff-nav-config";
import { cn } from "@/lib/utils";

type StaffMobileNavProps = {
  items: StaffNavItem[];
  panelRoot: "/admin" | "/operator";
};

function resolveSite(raw: string | null): "gpt-store" | "subs-store" {
  return raw === "subs-store" ? "subs-store" : "gpt-store";
}

function isNavActive(pathname: string, href: string, panelRoot: "/admin" | "/operator"): boolean {
  if (href === panelRoot) return pathname === panelRoot;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StaffMobileNav({ items, panelRoot }: StaffMobileNavProps) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const siteSlug = resolveSite(sp.get("site"));
  const site = getSiteBySlug(siteSlug);
  const accent = site.primaryColor;
  const badges = useStaffNavBadges(siteSlug);
  const landingHref = siteSlug === "subs-store" ? "/spotify" : "/";

  return (
    <div className="border-b border-gray-200 bg-white md:hidden">
      <nav
        className="flex gap-1.5 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Навигация панели"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const href = staffNavHref(item.href, siteSlug);
          const active = isNavActive(pathname, item.href, panelRoot);
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                active ? "text-gray-900" : "text-gray-600 hover:bg-black/[0.04] hover:text-gray-900",
              )}
              style={active ? { backgroundColor: `${accent}14`, color: accent } : undefined}
            >
              <Icon size={14} className={active ? "" : "text-gray-500"} />
              <span className="whitespace-nowrap">{item.label}</span>
              {item.badge ? <StaffNavBadge count={badges[item.badge]} /> : null}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 px-3 py-2 text-[11px]">
        <Link href="/login?switch=1" className="text-gray-500 hover:text-gray-800">
          Сменить аккаунт
        </Link>
        <form action={`/api/auth/signout?site=${encodeURIComponent(siteSlug)}`} method="POST" className="inline">
          <button type="submit" className="text-gray-500 hover:text-gray-800">
            Выйти
          </button>
        </form>
        <Link href={landingHref} className="text-gray-500 hover:text-gray-800">
          На сайт →
        </Link>
      </div>
    </div>
  );
}
