'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: 'Holdings', href: '/platform' },
  { label: 'Kontrollen', href: '/platform/audit' },
  { label: 'Berichte', href: '/platform/reports' },
  { label: 'Abrechnung', href: '/platform/billing' },
  { label: 'Gesundheit', href: '/platform/health' },
]

type EnuraAdminBarProps = {
  userName: string
}

export function EnuraAdminBar({ userName }: EnuraAdminBarProps) {
  const pathname = usePathname()

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex h-11 items-center justify-between px-4"
      style={{ backgroundColor: '#1E293B' }}
    >
      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-6">
        <Link href="/platform" className="flex items-center gap-2 text-white font-semibold text-sm">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
          Enura Group
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/platform' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Right: User + Dashboard link */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          ← Dashboard
        </Link>
        <span className="text-xs text-slate-400">{userName}</span>
      </div>
    </div>
  )
}
