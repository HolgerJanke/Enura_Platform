'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOutAction } from '@/app/actions'
import { getHelpArticleForPath } from '@/app/help/data'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DashboardShellProps = {
  companyName: string
  userName: string
  userRole: string
  isHoldingAdmin?: boolean
  isSuperUser?: boolean
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardShell({
  companyName,
  userName,
  userRole,
  isHoldingAdmin = false,
  isSuperUser = false,
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
          {(isHoldingAdmin || isSuperUser) && (
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
              {isHoldingAdmin && (
                <div className="rounded-xl border-2 border-gray-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Holding Admin</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Unternehmen', href: '/admin', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
                      { label: 'Benutzer', href: '/admin/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
                      { label: 'Finanzen', href: '/admin/finance', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
                      { label: 'Secrets', href: '/admin/secrets', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
                      { label: 'Tools', href: '/admin/tools', icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' },
                      { label: 'Prozesse', href: '/admin/processes', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
                      { label: 'Prozesshaus', href: '/admin/processes/house', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
                      { label: 'Analytics', href: '/admin/analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                      { label: 'Compliance', href: '/admin/compliance', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
                      { label: 'Branding', href: '/admin/settings/branding', icon: 'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z' },
                      { label: 'Berechtigungen', href: '/admin/settings/permissions', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
                      { label: 'Rollen', href: '/admin/settings/roles', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
                      { label: 'Add-ons', href: '/admin/settings/addons', icon: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z' },
                    ].map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setAdminModalOpen(false)} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-gray-50 hover:border-gray-300 transition-all">
                        <svg className="h-5 w-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} /></svg>
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {isSuperUser && (
                <div className="rounded-xl border-2 border-gray-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Company Admin</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Leitfaden', href: '/settings/call-script', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                      { label: 'Integrationen', href: '/settings/connectors', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
                      { label: 'Benutzer', href: '/settings/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
                      { label: 'Branding', href: '/settings/branding', icon: 'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z' },
                      { label: 'Berichte', href: '/settings/reports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                    ].map((item) => (
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
