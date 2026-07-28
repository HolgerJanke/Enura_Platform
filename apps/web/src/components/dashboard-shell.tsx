'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOutAction } from '@/app/actions'
import { getHelpArticleForPath } from '@/app/help/data'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompanyAdminNavItem = {
  label: string
  href: string
  icon: string
}

type DashboardShellProps = {
  companyName: string
  userName: string
  userRole: string
  /**
   * NOTE (finding C8 / OD-1): this shell used to also accept `isHoldingAdmin`
   * and render a hardcoded "Holding Admin" section of `/admin/*` links in the
   * modal below. Per OD-1 a holding admin is not a Company user — the
   * (dashboard) layout's own company-tier gate (`canEnterTier(session,
   * 'company')`) now bounces a holding/enura admin before this shell ever
   * renders, so that section was unreachable dead code that also violated
   * the two-worlds separation (a Company shell rendering Holding-tier nav).
   * It has been removed; the prop was removed with it. The Company section
   * below (super_user-only) is untouched.
   */
  isSuperUser?: boolean
  /**
   * The Company-Admin link list, pre-filtered by the server layout via
   * `filterNav(NAV_CONFIG.companyAdmin, session)` (lib/nav/nav-config.ts) —
   * this component is a client component and cannot resolve the authz
   * policy itself, so "visible ⇔ accessible" is enforced upstream and this
   * prop is simply rendered as-is.
   */
  companyAdminNavItems?: CompanyAdminNavItem[]
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardShell({
  companyName,
  userName,
  userRole,
  isSuperUser = false,
  companyAdminNavItems = [],
  children,
}: DashboardShellProps) {
  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const pathname = usePathname()
  const helpArticle = getHelpArticleForPath(pathname)
  const helpHref = helpArticle ? `/help/${helpArticle.level}/${helpArticle.slug}` : '/help'

  return (
    <div className="min-h-screen bg-brand-background">
      {/* Header Bar */}
      <header
        className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 px-4 sm:px-6"
        style={{ backgroundColor: 'var(--brand-surface, #F9FAFB)' }}
      >
        {/* Left: Logo + Company Name */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {companyName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden sm:block text-sm font-semibold text-brand-text-primary truncate max-w-[180px]">
              {companyName}
            </span>
          </Link>
        </div>

        {/* Center: User Name + Role */}
        <div className="hidden md:flex flex-col items-center">
          <span className="text-sm font-medium text-brand-text-primary">Willkommen, {userName}</span>
          <span className="text-[10px] text-brand-text-secondary">{userRole}</span>
        </div>

        {/* Right: Help + Admin + Logout */}
        <div className="flex items-center gap-1">
          {/* Mobile: User name */}
          <span className="md:hidden text-xs text-brand-text-secondary mr-2 truncate max-w-[80px]">
            {userName.split(' ')[0]}
          </span>

          {/* Help — context-aware link */}
          <Link
            href={helpHref}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-secondary hover:bg-gray-100 hover:text-brand-text-primary transition-colors"
            aria-label="Hilfe"
            title="Hilfe"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-6v.01M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            </svg>
          </Link>

          {/* Admin Console */}
          {isSuperUser && (
            <button
              type="button"
              onClick={() => setAdminModalOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-secondary hover:bg-gray-100 hover:text-brand-text-primary transition-colors"
              aria-label="Admin Konsole"
              title="Admin Konsole"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}

          {/* Logout */}
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-secondary hover:bg-gray-100 hover:text-brand-text-primary transition-colors"
              aria-label="Abmelden"
              title="Abmelden"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Admin Console Modal */}
      {adminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAdminModalOpen(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Escape') setAdminModalOpen(false) }} aria-label="Schließen" />
          <div className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Admin Konsole</h2>
            <p className="text-sm text-gray-500 mb-6">Wählen Sie den Verwaltungsbereich:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isSuperUser && (
                <div className="rounded-xl border-2 border-gray-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Company Admin</h3>
                  <div className="space-y-2">
                    {companyAdminNavItems.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setAdminModalOpen(false)} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-gray-50 hover:border-gray-300 transition-all">
                        <svg className="h-5 w-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} /></svg>
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button type="button" onClick={() => setAdminModalOpen(false)} className="mt-4 w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
