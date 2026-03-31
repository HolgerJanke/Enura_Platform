'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOutAction } from '@/app/actions'
import type { MainProcessGroup } from '@/lib/process-nav'

type NavItem = {
  label: string
  href: string
  icon: string
  permission: string | null
}

type DashboardShellProps = {
  companyName: string
  navItems: NavItem[]
  processGroups?: MainProcessGroup[]
  userName: string
  userRole: string
  children: React.ReactNode
}

const ROLE_LABELS: Record<string, string> = {
  super_user: 'Super User',
  geschaeftsfuehrung: 'Geschaeftsfuehrung',
  teamleiter: 'Teamleiter',
  setter: 'Setter',
  berater: 'Berater',
  innendienst: 'Innendienst',
  bau: 'Bau / Montage',
  buchhaltung: 'Buchhaltung',
  leadkontrolle: 'Leadkontrolle',
  holding_admin: 'Holding Admin',
}

const PROCESS_GROUP_ICONS: Record<string, string> = {
  TrendingUp: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  CalendarDays: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  ClipboardCheck: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  Wrench: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  MoreHorizontal: 'M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z',
}

/** Maximum items shown in the mobile bottom nav (excluding "Mehr") */
const BOTTOM_NAV_MAX = 5

export function DashboardShell({
  companyName,
  navItems,
  processGroups = [],
  userName,
  userRole,
  children,
}: DashboardShellProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(processGroups.map((g) => g.key)),
  )

  const roleLabel = ROLE_LABELS[userRole] ?? userRole

  // Split nav items for mobile bottom bar
  const bottomNavItems = navItems.slice(0, BOTTOM_NAV_MAX)
  const overflowNavItems = navItems.slice(BOTTOM_NAV_MAX)
  // Include process items in overflow on mobile
  const processNavFlat = processGroups.flatMap((g) =>
    g.processes.map((p) => ({
      label: p.menuLabel,
      href: p.href,
      icon: p.menuIcon || 'Circle',
      permission: null,
    })),
  )
  const allOverflowItems = [...overflowNavItems, ...processNavFlat]
  const hasOverflow = allOverflowItems.length > 0

  const isActive = useCallback(
    (href: string) =>
      pathname === href || (href !== '/dashboard' && pathname.startsWith(href)),
    [pathname],
  )

  const closeAll = useCallback(() => {
    setSidebarOpen(false)
    setMoreDrawerOpen(false)
  }, [])

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-brand-background">
      {/* ---------------------------------------------------------------- */}
      {/*  Desktop sidebar overlay (for mobile hamburger menu)             */}
      {/* ---------------------------------------------------------------- */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSidebarOpen(false)
          }}
          role="button"
          tabIndex={0}
          aria-label="Seitenleiste schliessen"
        />
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Desktop sidebar                                                 */}
      {/* ---------------------------------------------------------------- */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200
          bg-brand-surface transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Tenant logo / name */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-brand text-sm font-bold text-white"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {companyName.charAt(0).toUpperCase()}
          </div>
          <span className="truncate text-sm font-semibold text-brand-text-primary">
            {companyName}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Hauptnavigation">
          {/* Static nav items */}
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href)

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 rounded-brand px-3 py-2.5 text-sm font-medium
                      transition-colors duration-150
                      ${
                        active
                          ? 'text-white'
                          : 'text-brand-text-secondary hover:bg-gray-100 hover:text-brand-text-primary'
                      }
                    `}
                    style={active ? { backgroundColor: 'var(--brand-primary)' } : undefined}
                    aria-current={active ? 'page' : undefined}
                  >
                    <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Process groups */}
          {processGroups.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-brand-text-secondary">
                Prozesse
              </p>
              <div className="space-y-1">
                {processGroups.map((group) => {
                  const isExpanded = expandedGroups.has(group.key)
                  const hasActiveChild = group.processes.some((p) => isActive(p.href))

                  return (
                    <div key={group.key}>
                      {/* Group header — collapsible */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className={`
                          flex w-full items-center justify-between gap-2 rounded-brand px-3 py-2 text-xs font-semibold
                          transition-colors duration-150
                          ${hasActiveChild
                            ? 'text-brand-text-primary'
                            : 'text-brand-text-secondary hover:bg-gray-100 hover:text-brand-text-primary'
                          }
                        `}
                        aria-expanded={isExpanded}
                        aria-label={`${group.label} ${isExpanded ? 'einklappen' : 'ausklappen'}`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={PROCESS_GROUP_ICONS[group.icon] ?? 'M12 6v6m0 0v6m0-6h6m-6 0H6'}
                            />
                          </svg>
                          {group.label}
                        </span>
                        <svg
                          className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Group children */}
                      {isExpanded && (
                        <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 pl-3">
                          {group.processes.map((proc) => {
                            const active = isActive(proc.href)

                            return (
                              <li key={proc.id}>
                                <Link
                                  href={proc.href}
                                  onClick={() => setSidebarOpen(false)}
                                  className={`
                                    flex items-center gap-2 rounded-brand px-3 py-2 text-xs font-medium
                                    transition-colors duration-150
                                    ${
                                      active
                                        ? 'text-white'
                                        : 'text-brand-text-secondary hover:bg-gray-100 hover:text-brand-text-primary'
                                    }
                                  `}
                                  style={active ? { backgroundColor: 'var(--brand-primary)' } : undefined}
                                  aria-current={active ? 'page' : undefined}
                                >
                                  {proc.menuIcon && (
                                    <span className="text-sm" role="img" aria-hidden="true">
                                      {proc.menuIcon}
                                    </span>
                                  )}
                                  <span className="truncate">{proc.menuLabel}</span>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-gray-200 px-4 py-4">
          <div className="mb-3">
            <p className="truncate text-sm font-medium text-brand-text-primary">{userName}</p>
            <p className="truncate text-xs text-brand-text-secondary">{roleLabel}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-brand px-3 py-2 text-sm font-medium text-brand-text-secondary transition-colors hover:bg-gray-100 hover:text-brand-text-primary"
              aria-label="Abmelden"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Abmelden</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ---------------------------------------------------------------- */}
      {/*  Main content area                                               */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center border-b border-gray-200 bg-brand-surface px-4 lg:hidden safe-area-pt">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-brand text-brand-text-secondary hover:bg-gray-100 hover:text-brand-text-primary"
            aria-label="Navigation oeffnen"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="ml-3 truncate text-sm font-semibold text-brand-text-primary">
            {companyName}
          </span>
        </header>

        {/* Page content — add bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Mobile bottom navigation                                        */}
      {/* ---------------------------------------------------------------- */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around border-t border-gray-200 bg-brand-surface safe-area-pb lg:hidden"
        style={{ height: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
        aria-label="Mobile Navigation"
      >
        {bottomNavItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeAll}
              className={`
                flex h-14 min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-xs
                transition-colors duration-150
                ${active ? 'font-semibold' : 'text-brand-text-secondary'}
              `}
              style={active ? { color: 'var(--brand-primary)' } : undefined}
              aria-current={active ? 'page' : undefined}
            >
              <NavIcon name={item.icon} className="h-5 w-5" />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          )
        })}

        {/* "Mehr" button */}
        {hasOverflow && (
          <button
            type="button"
            onClick={() => setMoreDrawerOpen(true)}
            className={`
              flex h-14 min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-xs
              text-brand-text-secondary transition-colors duration-150
            `}
            aria-label="Mehr anzeigen"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="5" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="19" r="1.5" fill="currentColor" />
            </svg>
            <span>Mehr</span>
          </button>
        )}
      </nav>

      {/* ---------------------------------------------------------------- */}
      {/*  "Mehr" full-screen drawer                                       */}
      {/* ---------------------------------------------------------------- */}
      {moreDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            onClick={() => setMoreDrawerOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMoreDrawerOpen(false)
            }}
            role="button"
            tabIndex={0}
            aria-label="Drawer schliessen"
          />

          {/* Drawer panel — slides up from bottom */}
          <div className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[85vh] flex-col rounded-t-2xl bg-brand-surface shadow-2xl safe-area-pb lg:hidden">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="h-1 w-10 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 pb-3">
              <span className="text-base font-semibold text-brand-text-primary">
                Weitere Module
              </span>
              <button
                type="button"
                onClick={() => setMoreDrawerOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-brand text-brand-text-secondary hover:bg-gray-100"
                aria-label="Schliessen"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Overflow nav items */}
            <nav className="flex-1 overflow-y-auto px-4 py-3" aria-label="Weitere Navigation">
              {/* Static overflow items */}
              {overflowNavItems.length > 0 && (
                <ul className="space-y-1 mb-4">
                  {overflowNavItems.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={closeAll}
                          className={`
                            flex min-h-[44px] items-center gap-3 rounded-brand px-3 py-3 text-sm font-medium
                            transition-colors duration-150
                            ${
                              active
                                ? 'text-white'
                                : 'text-brand-text-secondary hover:bg-gray-100 hover:text-brand-text-primary'
                            }
                          `}
                          style={active ? { backgroundColor: 'var(--brand-primary)' } : undefined}
                          aria-current={active ? 'page' : undefined}
                        >
                          <NavIcon name={item.icon} className="h-5 w-5" />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* Process groups in drawer */}
              {processGroups.length > 0 && (
                <div>
                  <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-brand-text-secondary">
                    Prozesse
                  </p>
                  {processGroups.map((group) => (
                    <div key={group.key} className="mb-2">
                      <p className="px-3 py-1 text-xs font-semibold text-brand-text-secondary">
                        {group.label}
                      </p>
                      <ul className="space-y-0.5">
                        {group.processes.map((proc) => {
                          const active = isActive(proc.href)
                          return (
                            <li key={proc.id}>
                              <Link
                                href={proc.href}
                                onClick={closeAll}
                                className={`
                                  flex min-h-[44px] items-center gap-3 rounded-brand px-3 py-3 text-sm font-medium
                                  transition-colors duration-150
                                  ${
                                    active
                                      ? 'text-white'
                                      : 'text-brand-text-secondary hover:bg-gray-100 hover:text-brand-text-primary'
                                  }
                                `}
                                style={active ? { backgroundColor: 'var(--brand-primary)' } : undefined}
                                aria-current={active ? 'page' : undefined}
                              >
                                {proc.menuIcon && (
                                  <span className="text-lg" role="img" aria-hidden="true">
                                    {proc.menuIcon}
                                  </span>
                                )}
                                <span>{proc.menuLabel}</span>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </nav>

            {/* User info + logout in drawer */}
            <div className="border-t border-gray-200 px-5 py-4">
              <div className="mb-3">
                <p className="truncate text-sm font-medium text-brand-text-primary">{userName}</p>
                <p className="truncate text-xs text-brand-text-secondary">{roleLabel}</p>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex min-h-[44px] w-full items-center gap-2 rounded-brand px-3 py-2.5 text-sm font-medium text-brand-text-secondary transition-colors hover:bg-gray-100 hover:text-brand-text-primary"
                  aria-label="Abmelden"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Abmelden</span>
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// NavIcon — SVG icon component for nav items
// ---------------------------------------------------------------------------

const ICON_PATHS: Record<string, string> = {
  LayoutDashboard: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z',
  Phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  Briefcase: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  Users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  ClipboardList: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  Building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  Banknote: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  Settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  Circle: 'M12 12m-9 0a9 9 0 1018 0 9 9 0 10-18 0',
  HelpCircle: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-6v.01M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3',
  TrendingUp: 'M23 6l-9.5 9.5-5-5L1 18',
}

function NavIcon({ name, className }: { name: string; className?: string }) {
  const path = ICON_PATHS[name]
  if (!path) {
    // Fallback: render the string as emoji
    return <span className={className} role="img" aria-hidden="true">{name}</span>
  }

  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={path}
      />
    </svg>
  )
}
