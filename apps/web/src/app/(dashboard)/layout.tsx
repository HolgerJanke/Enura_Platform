export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getCompanyContext } from '@/lib/tenant'
import { getDataAccess } from '@/lib/data-access'
import { DashboardShellV2 } from '@/components/dashboard-shell-v2'
import type { ConnectorRow } from '@enura/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // If no session, show a loading/redirect state instead of calling redirect()
  // redirect() in Server Component layouts causes 404 on Vercel
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
  const companyName = session.isEnuraAdmin && !session.companyId
    ? 'Enura Group'
    : rawCompanyName

  const displayName = session.profile.display_name ?? session.profile.first_name ?? 'Benutzer'
  const roleLabel = session.roles[0]?.label ?? ''
  // ProfileRow doesn't have email — derive from display_name or fall back
  const userEmail = `${(session.profile.first_name ?? 'user').toLowerCase()}@${rawCompanyName.toLowerCase().replace(/\s+/g, '-')}.ch`

  const isSuperUser = session.roles.some(r => r.key === 'super_user')

  // Fetch connectors for sidebar status indicators
  let connectorInfos: { name: string; status: 'connected' | 'warning' | 'disconnected' }[] = []
  if (session.companyId) {
    const db = getDataAccess()
    const connectors = await db.connectors.findByCompanyId(session.companyId)
    connectorInfos = connectors.map((c: ConnectorRow) => ({
      name: c.name,
      status: c.status === 'active'
        ? 'connected' as const
        : c.status === 'paused' || c.status === 'error'
          ? 'warning' as const
          : 'disconnected' as const,
    }))
  }

  // Check for critical anomalies
  let criticalAnomalyCount = 0
  // Anomaly count is skipped when using mock data — no anomalies table in mock

  return (
    <DashboardShellV2
      companyName={companyName}
      userName={displayName}
      userEmail={userEmail}
      userRole={roleLabel}
      isHoldingAdmin={session.isHoldingAdmin}
      isSuperUser={isSuperUser}
      connectors={connectorInfos}
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
    </DashboardShellV2>
  )
}
