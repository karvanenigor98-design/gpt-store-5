'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ShoppingBag, MessageCircle, User, Star, Bell } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { getSiteBySlug, type SiteSlug } from '@/lib/sites'
import { useClientNotificationsContext } from '@/components/dashboard/ClientNotificationsContext'

export const DASHBOARD_NAV_ITEMS = [
  { base: '/dashboard', label: 'Главная', icon: LayoutDashboard },
  { base: '/dashboard/orders', label: 'Заказы', icon: ShoppingBag },
  { base: '/dashboard/chat', label: 'Поддержка', icon: MessageCircle },
  { base: '/dashboard/notifications', label: 'Уведомления', icon: Bell },
  { base: '/dashboard/reviews', label: 'Отзывы', icon: Star },
  { base: '/dashboard/profile', label: 'Профиль', icon: User },
]

interface NavProps {
  /** Server-resolved site slug (from cookie). */
  defaultSiteSlug: SiteSlug;
}

function resolveSiteSlug(defaultSiteSlug?: SiteSlug): SiteSlug {
  return defaultSiteSlug === 'subs-store' ? 'subs-store' : 'gpt-store'
}

function isCabinetHome(pathname: string): boolean {
  return pathname === '/dashboard' || pathname === '/cabinet'
}

function navItemActive(pathname: string, base: string): boolean {
  if (base === '/dashboard') return isCabinetHome(pathname)
  return pathname === base || pathname.startsWith(`${base}/`)
}

export function DashboardNav({ defaultSiteSlug }: NavProps) {
  const pathname = usePathname()
  const siteSlug = resolveSiteSlug(defaultSiteSlug)
  const site = getSiteBySlug(siteSlug)
  const siteQuery = `?site=${siteSlug}`
  const activeColor = site.primaryColor
  const { unread } = useClientNotificationsContext()

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
      {DASHBOARD_NAV_ITEMS.map((item) => {
        const href = item.base + siteQuery
        const isActive = navItemActive(pathname, item.base)
        const Icon = item.icon
        const showUnread = item.base === '/dashboard/notifications' && unread > 0
        return (
          <Link
            key={item.base}
            href={href}
            style={isActive ? { color: activeColor, borderLeftColor: activeColor } : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 border-l-2 ${
              isActive
                ? 'border-l-2'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border-transparent'
            }`}
          >
            <Icon
              size={16}
              style={isActive ? { color: activeColor } : undefined}
              className={isActive ? '' : 'text-gray-400'}
            />
            <span className="flex-1">{item.label}</span>
            {showUnread && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

export function DashboardMobileNav({ defaultSiteSlug }: NavProps) {
  const pathname = usePathname()
  const siteSlug = resolveSiteSlug(defaultSiteSlug)
  const site = getSiteBySlug(siteSlug)
  const siteQuery = `?site=${siteSlug}`
  const isSubs = site.slug === 'subs-store'
  const { unread } = useClientNotificationsContext()

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex border-t md:hidden',
        isSubs
          ? 'border-white/10 bg-[#111111] shadow-[0_-6px_24px_rgba(0,0,0,0.45)]'
          : 'border-gray-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]',
      )}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.35rem)' }}
      aria-label="Навигация кабинета"
    >
      {DASHBOARD_NAV_ITEMS.map((item) => {
        const href = item.base + siteQuery
        const isActive = navItemActive(pathname, item.base)
        const Icon = item.icon
        const activeColor = site.primaryColor
        const showUnread = item.base === '/dashboard/notifications' && unread > 0
        return (
          <Link
            key={item.base}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10px] leading-tight transition-colors',
              isActive ? 'font-semibold' : 'font-medium',
              !isActive &&
                (isSubs ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'),
            )}
          >
            <span
              className={cn(
                'relative flex items-center justify-center rounded-xl px-2 py-1 transition-colors',
                isActive && (isSubs ? 'bg-white/12' : 'bg-black/[0.04]'),
              )}
              style={isActive ? { color: activeColor } : undefined}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 2}
                className={cn('shrink-0', !isActive && (isSubs ? 'text-gray-400' : 'text-gray-500'))}
                style={isActive ? { color: activeColor } : undefined}
              />
              {showUnread && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </span>
            <span
              className="max-w-full truncate text-center"
              style={isActive ? { color: activeColor } : undefined}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
