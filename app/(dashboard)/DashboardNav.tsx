'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ShoppingBag, MessageCircle, User, Star } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useSafePathname } from '@/lib/client/useSafePathname'
import { getSiteBySlug } from '@/lib/sites'

const NAV_ITEMS = [
  { base: '/dashboard', label: 'Главная', icon: LayoutDashboard },
  { base: '/dashboard/orders', label: 'Заказы', icon: ShoppingBag },
  { base: '/dashboard/chat', label: 'Поддержка', icon: MessageCircle },
  { base: '/dashboard/reviews', label: 'Отзывы', icon: Star },
  { base: '/dashboard/profile', label: 'Профиль', icon: User },
]

interface NavProps {
  /** Server-resolved site slug (from cookie). Falls back to URL ?site= param. */
  defaultSiteSlug?: string;
}

export function DashboardNav({ defaultSiteSlug }: NavProps) {
  const pathname = useSafePathname()
  const searchParams = useSearchParams()
  const siteSlug = searchParams.get('site') ?? defaultSiteSlug ?? null
  const site = getSiteBySlug(siteSlug)
  const siteQuery = siteSlug ? `?site=${siteSlug}` : ''
  const activeColor = site.primaryColor

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
      {NAV_ITEMS.map((item) => {
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
  const searchParams = useSearchParams()
  const siteSlug = searchParams.get('site') ?? defaultSiteSlug ?? null
  const site = getSiteBySlug(siteSlug)
  const siteQuery = siteSlug ? `?site=${siteSlug}` : ''
  const isSubs = site.slug === 'subs-store'

  return (
    <nav className="flex gap-4">
      {NAV_ITEMS.map((item) => {
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
            className={isActive ? '' : cn(isSubs ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900')}
            aria-label={item.label}
          >
            <Icon size={20} />
          </Link>
        )
      })}
    </nav>
  )
}
