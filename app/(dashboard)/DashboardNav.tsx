'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ShoppingBag, MessageCircle, User, Star } from 'lucide-react'
import { useSafePathname } from '@/lib/client/useSafePathname'
import { getSiteBySlug, type SiteSlug } from '@/lib/sites'

export const DASHBOARD_NAV_ITEMS = [
  { base: '/dashboard', label: 'Главная', icon: LayoutDashboard },
  { base: '/dashboard/orders', label: 'Заказы', icon: ShoppingBag },
  { base: '/dashboard/chat', label: 'Поддержка', icon: MessageCircle },
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

export function DashboardNav({ defaultSiteSlug }: NavProps) {
  const pathname = useSafePathname()
  const siteSlug = resolveSiteSlug(defaultSiteSlug)
  const site = getSiteBySlug(siteSlug)
  const siteQuery = `?site=${siteSlug}`
  const activeColor = site.primaryColor

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
      {DASHBOARD_NAV_ITEMS.map((item) => {
        const href = item.base + siteQuery
        const isActive =
          item.base === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.base || pathname.startsWith(item.base + '/')
        const Icon = item.icon
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
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function DashboardMobileNav({ defaultSiteSlug }: NavProps) {
  const pathname = useSafePathname()
  const siteSlug = resolveSiteSlug(defaultSiteSlug)
  const site = getSiteBySlug(siteSlug)
  const siteQuery = `?site=${siteSlug}`
  const isSubs = site.slug === 'subs-store'

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex border-t md:hidden',
        isSubs ? 'border-white/10 bg-[#111111]' : 'border-gray-200 bg-white/95 backdrop-blur-md',
      )}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.25rem)' }}
      aria-label="Навигация кабинета"
    >
      {DASHBOARD_NAV_ITEMS.map((item) => {
        const href = item.base + siteQuery
        const isActive =
          item.base === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.base || pathname.startsWith(item.base + '/')
        const Icon = item.icon
        return (
          <Link
            key={item.base}
            href={href}
            style={isActive ? { color: site.primaryColor } : undefined}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-tight',
              isActive
                ? ''
                : isSubs
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-500 hover:text-gray-900',
            )}
          >
            <Icon size={18} className="shrink-0" />
            <span className="max-w-full truncate text-center">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
