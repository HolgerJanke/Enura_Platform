import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getCompanyContext } from '@/lib/tenant'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildProcessNavGroups } from '@/lib/process-nav'
import { DashboardShell } from '@/components/dashboard-shell'
import type { MainProcessGroup } from '@/lib/process-nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { companyName } = getCompanyContext()

  const staticNavItems = [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', permission: null as string | null },
    { label: 'Setter', href: '/setter', icon: 'Phone', permission: 'module:setter:read' },
    { label: 'Berater', href: '/berater', icon: 'Briefcase', permission: 'module:berater:read' },
    { label: 'Leads', href: '/leads', icon: 'Users', permission: 'module:leads:read' },
    { label: 'Innendienst', href: '/innendienst', icon: 'ClipboardList', permission: 'module:innendienst:read' },
    { label: 'Projekte', href: '/projects', icon: 'Building', permission: 'module:bau:read' },
    { label: 'Finanzen', href: '/finance', icon: 'Banknote', permission: 'module:finance:read' },
    { label: 'Liquiditaet', href: '/liquidity', icon: 'TrendingUp', permission: 'module:finance:read' },
    { label: 'Einstellungen', href: '/settings/users', icon: 'Settings', permission: 'module:admin:read' },
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

  return (
    <DashboardShell
      companyName={companyName}
      navItems={navItems}
      processGroups={processGroups}
      userName={displayName}
      userRole={roleLabel}
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
  )
}
