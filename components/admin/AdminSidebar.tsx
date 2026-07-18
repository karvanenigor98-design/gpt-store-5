"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  MessageCircle,
  Star,
  Settings,
  Users,
  UserCircle,
  Percent,
  Tag,
  Layers,
  Globe,
  Bell,
} from "lucide-react";
import { StaffNavBadge } from "@/components/admin/StaffNavBadge";
import { useStaffNavBadges } from "@/components/admin/useStaffNavBadges";
import { getAdminSelectedSiteSlug } from "@/components/admin/SiteSwitcher";
import { resolveStaffSiteSlug } from "@/lib/admin/resolveStaffSiteSlug";
import { getSiteBySlug } from "@/lib/sites";
import { cn } from "@/lib/utils";

type BadgeKey = "notifications" | "chat" | "orders" | "reviews" | null;

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; badge: BadgeKey }[] = [
  { href: "/admin", label: "Главная", icon: LayoutDashboard, badge: null },
  { href: "/admin/sites", label: "Магазины", icon: Globe, badge: null },
  { href: "/admin/orders", label: "Заказы", icon: ShoppingBag, badge: "orders" },
  { href: "/admin/clients", label: "Клиенты", icon: UserCircle, badge: null },
  { href: "/admin/users", label: "Пользователи", icon: Users, badge: null },
  { href: "/admin/chat", label: "Чат", icon: MessageCircle, badge: "chat" },
  { href: "/admin/notifications", label: "Уведомления", icon: Bell, badge: "notifications" },
  { href: "/admin/tariffs", label: "Тарифы", icon: Layers, badge: null },
  { href: "/admin/promocodes", label: "Промокоды", icon: Tag, badge: null },
  { href: "/admin/discounts", label: "Скидки", icon: Percent, badge: null },
  { href: "/admin/reviews", label: "Отзывы", icon: Star, badge: "reviews" },
  { href: "/admin/settings", label: "Настройки", icon: Settings, badge: null },
];

function withSiteQuery(path: string, site: string | null): string {
  if (!site) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}site=${encodeURIComponent(site)}`;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const site = resolveStaffSiteSlug(sp, getAdminSelectedSiteSlug());
  const siteDef = getSiteBySlug(site);
  const accent = siteDef.primaryColor;
  const badges = useStaffNavBadges(site);

  return (
    <aside className="hidden w-56 flex-col border-r border-black/[0.06] bg-white/85 backdrop-blur-md md:flex">
      <div className="flex h-14 items-center border-b border-black/[0.06] px-4">
        <Link
          href={withSiteQuery("/admin", site)}
          className="font-heading text-sm font-semibold text-gray-900"
        >
          GPT <span style={{ color: "#10a37f" }}>STORE</span>
          <span className="mt-0.5 block text-[10px] font-normal text-gray-500">Admin Panel</span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const href = withSiteQuery(item.href, site);
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={href}
              prefetch={item.href === "/admin/orders" ? false : undefined}
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
              <Icon size={15} className={isActive ? "" : "text-gray-500"} />
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
        <form
          action={`/api/auth/signout?site=${encodeURIComponent(site ?? "gpt-store")}&global=1`}
          method="POST"
        >
          <button
            type="submit"
            className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-800"
          >
            Выйти
          </button>
        </form>
        <Link
          href={site === "subs-store" ? "/spotify" : "/"}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-800"
        >
          На сайт →
        </Link>
      </div>
    </aside>
  );
}
