import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getCompanyContext } from '@/lib/tenant'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildProcessNavGroups } from '@/lib/process-nav'
import { checkFinanzplanungActive } from '@/lib/finanzplanung-guard'
import { DashboardShell } from '@/components/dashboard-shell'
import { AdminBar } from '@/components/AdminBar'
import type { MainProcessGroup } from '@/lib/process-nav'

const SUPER_USER_NAV = [
  { label: 'Prozesse', href: '/settings/call-script' },
  { label: 'Integrationen', href: '/settings/connectors' },
  { label: 'Benutzer', href: '/settings/users' },
  { label: 'Branding', href: '/settings/branding' },
  { label: 'Berichte', href: '/settings/reports' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // If no session, show a loading/redirect state instead of calling redirect()
  // redirect() in Server Component layouts causes 404 on Vercel
  // The middleware handles the actual auth redirect
  if (!session) {
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: 'window.location.href="/login"' }} />
        <div className="min-h-screen flex items-center justify-center bg-brand-background">
          <div className="text-center">
            <p className="text-brand-text-secondary mb-4">Weiterleitung zur Anmeldung...</p>
            <a href="/login" className="text-brand-primary underline text-sm">
              Zur Anmeldung
            </a>
          </div>
        </div>
      </>
    )
  }

  const { companyName: rawCompanyName } = getCompanyContext()
  // Enura admins with no company see neutral branding
  const companyName = session.isEnuraAdmin && !session.companyId
    ? 'Enura Group'
    : rawCompanyName

  const staticNavItems = [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', permission: null as string | null },
    ...(session.isEnuraAdmin ? [{ label: 'Plattform', href: '/platform', icon: 'Globe', permission: null as string | null }] : []),
    { label: 'Hilfe', href: '/help', icon: 'HelpCircle', permission: null as string | null },
  ].filter((item) => {
    if (!item.permission) return true
    if (session.isHoldingAdmin) return true
    return session.permissions.includes(item.permission)
  })

  // Build grouped process navigation
  const processGroups: MainProcessGroup[] = await buildProcessNavGroups(session)

  const navItems = staticNavItems

  const displayName = session.profile.display_name ?? session.profile.first_name ?? 'Benutzer'
  const roleLabel = session.roles[0]?.label ?? ''

  // Fetch active critical anomaly count for banner
  let criticalAnomalyCount = 0
  if (session.companyId) {
    const supabase = createSupabaseServerClient()
    const { count } = await supabase
      .from('anomalies')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', session.companyId)
      .eq('is_active', true)
      .eq('severity', 'critical')

    criticalAnomalyCount = count ?? 0
  }

  // Check if Finanzplanung module is active for this company
  const hasFinanzplanung = await checkFinanzplanungActive(session)
  const hasFpRead = hasFinanzplanung && (session.isHoldingAdmin || session.permissions.includes('module:finanzplanung:read'))

  // Add Finanzplanung nav items if module is active
  if (hasFpRead) {
    staticNavItems.push(
      { label: 'Finanzplanung', href: '/finanzplanung', icon: 'Banknote', permission: 'module:finanzplanung:read' },
    )
  }

  const isSuperUser = session.roles.some(r => r.key === 'super_user')

  return (
    <>
      <DashboardShell
        companyName={companyName}
        navItems={navItems}
        processGroups={processGroups}
        userName={displayName}
        userRole={roleLabel}
        isHoldingAdmin={session.isHoldingAdmin}
        isSuperUser={isSuperUser}
      >
        {criticalAnomalyCount > 0 && (
        <div className="border-b border-red-300 bg-red-600 px-4 py-2.5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" aria-hidden="true">&#9888;&#65039;</span>
              <span className="text-sm font-medium">
                {criticalAnomalyCount === 1
                  ? '1 kritische Anomalie erkannt'
                  : `${criticalAnomalyCount} kritische Anomalien erkannt`}
              </span>
            </div>
            <Link
              href="/anomalies"
              className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/30"
            >
              Alle anzeigen
            </Link>
          </div>
        </div>
      )}
      {children}
    </DashboardShell>
    </>
  )
}
