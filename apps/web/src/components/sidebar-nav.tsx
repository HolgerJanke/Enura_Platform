'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOutAction } from '@/app/actions'
import {
  navigationSections,
  settingsNavItem,
  type NavigationSection,
  type NavigationItem,
} from '@enura/types'

// ---------------------------------------------------------------------------
// Icons as inline SVG components (to avoid icon library dependency)
// ---------------------------------------------------------------------------

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 6a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z" />
    </svg>
  )
}

function IconSales({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function IconProject({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}

function IconMontage({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconAnalytics({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function IconFinance({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  )
}

function IconBot({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-1.46 1.46a3.375 3.375 0 01-4.78 0L12 15.2l-.76.76a3.375 3.375 0 01-4.78 0L5 14.5m14 0V19a2 2 0 01-2 2H7a2 2 0 01-2-2v-4.5" />
    </svg>
  )
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Icon registry — maps icon keys from domain.ts to components
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: IconDashboard,
  sales: IconSales,
  project: IconProject,
  montage: IconMontage,
  analytics: IconAnalytics,
  finance: IconFinance,
  bot: IconBot,
  settings: IconSettings,
}

function getIcon(iconKey: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconKey] ?? IconDashboard
}

// ---------------------------------------------------------------------------
// Permission filtering
// ---------------------------------------------------------------------------

function filterByPermissions(
  sections: NavigationSection[],
  permissions: string[],
  isHoldingAdmin: boolean,
): NavigationSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.requiredPermission) return true
        if (isHoldingAdmin) return true
        return permissions.includes(item.requiredPermission)
      }),
    }))
    .filter((section) => section.items.length > 0)
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ConnectorInfo = {
  name: string
  status: 'connected' | 'warning' | 'disconnected'
}

type SidebarNavProps = {
  companyName: string
  userName: string
  userEmail: string
  userRole: string
  permissions: string[]
  isHoldingAdmin?: boolean
  isSuperUser?: boolean
  connectors?: ConnectorInfo[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SidebarNav({
  companyName: _companyName,
  userName,
  userEmail,
  userRole: _userRole,
  permissions,
  isHoldingAdmin = false,
  isSuperUser = false,
  connectors = [],
}: SidebarNavProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const statusDot = (status: ConnectorInfo['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-400'
      case 'warning':
        return 'bg-yellow-400'
      case 'disconnected':
        return 'bg-red-400'
    }
  }

  // Filter navigation by user permissions
  const visibleSections = filterByPermissions(navigationSections, permissions, isHoldingAdmin)

  // Settings visible if admin or super_user
  const showSettings =
    isHoldingAdmin ||
    isSuperUser ||
    permissions.includes(settingsNavItem.requiredPermission!)

  // User initials
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside className="sidebar-nav fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary text-sm font-bold text-white">
          E
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold text-white tracking-wide">enura</span>
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/50 font-medium">Platform</span>
        </div>
      </div>

      {/* Nav sections — driven by permissions */}
      <nav className="flex-1 px-3 py-2 space-y-5">
        {visibleSections.map((section) => (
          <div key={section.key}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                const Icon = getIcon(item.icon)
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                        active
                          ? 'bg-white/10 text-white'
                          : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/* Integrations section */}
        {connectors.length > 0 && (
          <div>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
              Integrationen
            </p>
            <ul className="space-y-0.5">
              {connectors.map((c) => (
                <li key={c.name}>
                  <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-white/60">
                    <span className={`h-2 w-2 rounded-full ${statusDot(c.status)}`} />
                    {c.name}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Settings (for admins) */}
        {showSettings && (
          <div>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href={settingsNavItem.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                    pathname.startsWith('/settings')
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                  }`}
                >
                  <IconSettings className="h-[18px] w-[18px] shrink-0" />
                  {settingsNavItem.label}
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* User section at bottom */}
      <div className="mt-auto border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-[11px] text-white/50 truncate">{userEmail}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
              aria-label="Abmelden"
              title="Abmelden"
            >
              <IconLogout className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
