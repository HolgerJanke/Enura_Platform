'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOutAction } from '@/app/actions'

type NavItem = {
  label: string
  href: string
  icon: string
  permission: string | null
}

type DashboardShellProps = {
  tenantName: string
  navItems: NavItem[]
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

/** Maximum items shown in the mobile bottom nav (excluding "Mehr") */
const BOTTOM_NAV_MAX = 5

export function DashboardShell({
  tenantName,
  navItems,
  userName,
  userRole,
  children,
}: DashboardShellProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false)

  const roleLabel = ROLE_LABELS[userRole] ?? userRole

  // Split nav items for mobile bottom bar
  const bottomNavItems = navItems.slice(0, BOTTOM_NAV_MAX)
  const overflowNavItems = navItems.slice(BOTTOM_NAV_MAX)
  const hasOverflow = overflowNavItems.length > 0

  const isActive = useCallback(
    (href: string) =>
      pathname === href || (href !== '/dashboard' && pathname.startsWith(href)),
    [pathname],
  )

  const closeAll = useCallback(() => {
    setSidebarOpen(false)
    setMoreDrawerOpen(false)
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
            {tenantName.charAt(0).toUpperCase()}
          </div>
          <span className="truncate text-sm font-semibold text-brand-text-primary">
            {tenantName}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Hauptnavigation">
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
                    <span className="text-base" role="img" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
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
              <span aria-hidden="true">🚪</span>
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
            {tenantName}
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
              <span className="text-lg" role="img" aria-hidden="true">
                {item.icon}
              </span>
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
              <ul className="space-y-1">
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
                        <span className="text-lg" role="img" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
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
                  <span aria-hidden="true">🚪</span>
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
