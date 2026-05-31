import type { LucideIcon } from "lucide-react";
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

export type StaffNavBadgeKey = "notifications" | "chat" | "orders" | null;

export type StaffNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge: StaffNavBadgeKey;
};

export const ADMIN_NAV_ITEMS: StaffNavItem[] = [
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
  { href: "/admin/reviews", label: "Отзывы", icon: Star, badge: null },
  { href: "/admin/settings", label: "Настройки", icon: Settings, badge: null },
];

export const OPERATOR_NAV_ITEMS: StaffNavItem[] = [
  { href: "/operator", label: "Главная", icon: LayoutDashboard, badge: null },
  { href: "/operator/orders", label: "Заказы", icon: ShoppingBag, badge: "orders" },
  { href: "/operator/clients", label: "Клиенты", icon: UserCircle, badge: null },
  { href: "/operator/chat", label: "Чат", icon: MessageCircle, badge: "chat" },
  { href: "/operator/notifications", label: "Уведомления", icon: Bell, badge: "notifications" },
];
