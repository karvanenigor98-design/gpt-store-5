"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { LayoutDashboard, ShoppingBag, MessageCircle, UserCircle, Bell } from "lucide-react";
import { getAdminSelectedSiteSlug } from "@/components/admin/SiteSwitcher";
import { StaffNavBadge } from "@/components/admin/StaffNavBadge";
import { useStaffNavBadges } from "@/components/admin/useStaffNavBadges";
import { getSiteBySlug } from "@/lib/sites";
import { staffNavHref } from "@/lib/admin/staffNavHref";
import { cn } from "@/lib/utils";

const NAV: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge: "orders" | "chat" | "notifications" | null;
}> = [
  { href: "/operator", label: "Главная", icon: LayoutDashboard, badge: null },
  { href: "/operator/orders", label: "Заказы", icon: ShoppingBag, badge: "orders" },
  { href: "/operator/clients", label: "Клиенты", icon: UserCircle, badge: null },
  { href: "/operator/chat", label: "Чат", icon: MessageCircle, badge: "chat" },
  { href: "/operator/notifications", label: "Уведомления", icon: Bell, badge: "notifications" },
];

function resolveSite(raw: string | null): "gpt-store" | "subs-store" {
  return raw === "subs-store" ? "subs-store" : "gpt-store";
}

export function OperatorSidebar() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const siteSlug = resolveSite(sp.get("site"));
  const site = getSiteBySlug(siteSlug);
  const accent = site.primaryColor;
  const badges = useStaffNavBadges(siteSlug);

  useEffect(() => {
    const urlSite = sp.get("site");
    if (urlSite === "gpt-store" || urlSite === "subs-store") return;
    const saved = getAdminSelectedSiteSlug();
    if (saved !== "gpt-store" && saved !== "subs-store") return;
    const q = new URLSearchParams(sp.toString());
    q.set("site", saved);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [sp, pathname, router]);

  return (
    <aside className="hidden w-56 flex-col border-r border-black/[0.06] bg-white/85 backdrop-blur-md md:flex">
      <div className="flex h-14 items-center border-b border-black/[0.06] px-4">
        <span className="font-heading text-sm font-semibold text-gray-900">
          {site.brandName.split(" ")[0]}{" "}
          <span style={{ color: accent }}>{site.brandName.split(" ").slice(1).join(" ") || "Store"}</span>
          <span className="mt-0.5 block text-[10px] font-normal text-gray-500">Operator</span>
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const href = staffNavHref(item.href, siteSlug);
          const isActive =
            item.href === "/operator"
              ? pathname === "/operator"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "font-medium text-gray-900"
                  : "text-gray-600 hover:bg-black/[0.04] hover:text-gray-900",
              )}
              style={
                isActive
                  ? { backgroundColor: `${accent}14`, color: accent }
                  : undefined
              }
            >
              <Icon size={15} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge ? <StaffNavBadge count={badges[item.badge]} /> : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-black/[0.06] p-2">
        <Link
          href="/login?switch=1"
          className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-800"
        >
          Сменить аккаунт
        </Link>
        <form action={`/api/auth/signout?site=${siteSlug}`} method="POST">
          <button
            type="submit"
            className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-800"
          >
            Выйти
          </button>
        </form>
        <Link
          href={siteSlug === "subs-store" ? "/spotify" : "/"}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-800"
        >
          На сайт →
        </Link>
      </div>
    </aside>
  );
}
