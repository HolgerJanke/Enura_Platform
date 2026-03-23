import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getTenantContext } from '@/lib/tenant'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { tenantName } = getTenantContext()

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: '\u{1F4CA}', permission: null as string | null },
    { label: 'Setter', href: '/setter', icon: '\u{1F4DE}', permission: 'module:setter:read' },
    { label: 'Berater', href: '/berater', icon: '\u{1F4BC}', permission: 'module:berater:read' },
    { label: 'Leads', href: '/leads', icon: '\u{1F465}', permission: 'module:leads:read' },
    { label: 'Innendienst', href: '/innendienst', icon: '\u{1F4CB}', permission: 'module:innendienst:read' },
    { label: 'Projekte', href: '/projects', icon: '\u{1F3D7}\uFE0F', permission: 'module:bau:read' },
    { label: 'Finanzen', href: '/finance', icon: '\u{1F4B0}', permission: 'module:finance:read' },
    { label: 'Einstellungen', href: '/settings/users', icon: '\u2699\uFE0F', permission: 'module:admin:read' },
  ].filter((item) => {
    if (!item.permission) return true
    if (session.isHoldingAdmin) return true
    return session.permissions.includes(item.permission)
  })

  const displayName = session.profile.display_name ?? session.profile.first_name ?? 'Benutzer'
  const roleLabel = session.roles[0]?.label ?? ''

  // Fetch active critical anomaly count for banner
  let criticalAnomalyCount = 0
  if (session.tenantId) {
    const supabase = createSupabaseServerClient()
    const { count } = await supabase
      .from('anomalies')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId)
      .eq('is_active', true)
      .eq('severity', 'critical')

    criticalAnomalyCount = count ?? 0
  }

  return (
    <DashboardShell
      tenantName={tenantName}
      navItems={navItems}
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
