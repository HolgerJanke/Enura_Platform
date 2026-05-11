export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { formatDate } from '@enura/types'
import type { ConnectorRow, LeadRow } from '@enura/types'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// KPI Card component
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  accentVar,
}: {
  label: string
  value: string | number
  sub?: string
  accentVar: string
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100">
      <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-brand-text-primary" style={{ color: `var(${accentVar})` }}>
        {value}
      </p>
      {sub && <p className="text-xs text-brand-text-secondary mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const _sp = await searchParams
  const session = await getSession()
  if (!session?.companyId) return null

  const db = getDataAccess()
  const cid = session.companyId

  // Parallel data fetch — use counts instead of fetching all rows
  const [
    connectors,
    recentLeadsResult,
    openLeads,
    pipelineTotal,
    wonCount,
    draftCount,
    sentCount,
    lostCount,
    expiredCount,
  ] = await Promise.all([
    db.connectors.findByCompanyId(cid),
    db.leads.findPaginated(cid, { page: 1, pageSize: 5 }),
    db.leads.count(cid),
    db.offers.sumAmountChf(cid, { excludeStatus: ['won', 'lost', 'expired'] }),
    db.offers.count(cid, { status: 'won' }),
    db.offers.count(cid, { status: 'draft' }),
    db.offers.count(cid, { status: 'sent' }),
    db.offers.count(cid, { status: 'lost' }),
    db.offers.count(cid, { status: 'expired' }),
  ])

  const activeOffers = draftCount + sentCount

  const displayName = session.profile.first_name ?? session.profile.display_name ?? 'Benutzer'

  // Derive greeting based on time of day
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'

  const pipelineValue = pipelineTotal > 1_000_000
    ? `CHF ${(pipelineTotal / 1_000_000).toFixed(1)}M`
    : pipelineTotal > 0
      ? `CHF ${Math.round(pipelineTotal).toLocaleString('de-CH')}`
      : 'CHF 0'

  const recentLeads = recentLeadsResult.data

  // Pipeline summary from counts
  const phaseCounts: Record<string, number> = {
    draft: draftCount,
    sent: sentCount,
    won: wonCount,
    lost: lostCount,
    expired: expiredCount,
  }

  // Connector status
  const connectorStatusLabel: Record<string, { label: string; dotClass: string }> = {
    active: { label: 'Aktiv', dotClass: 'bg-green-400' },
    paused: { label: 'Pausiert', dotClass: 'bg-yellow-400' },
    error: { label: 'Fehler', dotClass: 'bg-red-400' },
    disconnected: { label: 'Getrennt', dotClass: 'bg-gray-300' },
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">
          {greeting}, {displayName}
        </h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Hier ist Ihr Tagesüberblick.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pipeline-Wert" value={pipelineValue} sub="Gesamtwert aller offenen Angebote" accentVar="--brand-kpi-1" />
        <KpiCard label="Offene Leads" value={openLeads} sub="Aktuell im System" accentVar="--brand-kpi-2" />
        <KpiCard label="Aktive Angebote" value={activeOffers} sub="Entwurf oder versendet" accentVar="--brand-kpi-3" />
        <KpiCard label="Abschlüsse" value={wonCount} sub="Gewonnene Projekte" accentVar="--brand-kpi-1" />
      </div>

      {/* Two-column: Tasks + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heute im Fokus — 2 cols */}
        <div className="lg:col-span-2 rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-brand-text-primary">Heute im Fokus</h2>
            <Link href="/leads" className="text-xs font-medium text-brand-primary hover:underline">
              Alle Leads &rarr;
            </Link>
          </div>
          {recentLeads.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {recentLeads.map((lead: LeadRow) => (
                <li key={lead.id}>
                  <Link href={`/leads/${lead.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div>
                    <p className="text-sm font-medium text-brand-text-primary">
                      {`${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'Unbekannt'}
                    </p>
                    <p className="text-xs text-brand-text-secondary">
                      {lead.source ?? 'Unbekannt'} &middot; {lead.address_city ?? ''}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    lead.status === 'new' ? 'bg-blue-50 text-blue-700'
                    : lead.status === 'qualified' ? 'bg-green-50 text-green-700'
                    : lead.status === 'contacted' ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-gray-50 text-gray-600'
                  }`}>
                    {lead.status === 'new' ? 'Neu'
                    : lead.status === 'qualified' ? 'Qualifiziert'
                    : lead.status === 'contacted' ? 'Kontaktiert'
                    : lead.status ?? 'Offen'}
                  </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-brand-text-secondary">Keine aktuellen Leads.</p>
          )}
        </div>

        {/* Letzte Aktivitäten — 1 col */}
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-base font-semibold text-brand-text-primary mb-4">Systemstatus</h2>
          {connectors.length > 0 ? (
            <ul className="space-y-3">
              {connectors.map((connector: ConnectorRow) => {
                const info = connectorStatusLabel[connector.status] ?? {
                  label: connector.status,
                  dotClass: 'bg-gray-300',
                }
                return (
                  <li key={connector.id} className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${info.dotClass}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-text-primary truncate">{connector.name}</p>
                      {connector.last_synced_at && (
                        <p className="text-[11px] text-brand-text-secondary">
                          Sync: {formatDate(connector.last_synced_at)}
                        </p>
                      )}
                    </div>
                    <span className={`text-[11px] font-medium ${
                      connector.status === 'active' ? 'text-green-600' : 'text-brand-text-secondary'
                    }`}>
                      {info.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-brand-text-secondary">Keine Integrationen konfiguriert.</p>
          )}
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
        <h2 className="text-base font-semibold text-brand-text-primary mb-4">Prozess-Übersicht</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Entwurf', key: 'draft', color: 'bg-gray-100 text-gray-700' },
            { label: 'Versendet', key: 'sent', color: 'bg-blue-50 text-blue-700' },
            { label: 'Gewonnen', key: 'won', color: 'bg-green-50 text-green-700' },
            { label: 'Verloren', key: 'lost', color: 'bg-red-50 text-red-700' },
            { label: 'Abgelaufen', key: 'expired', color: 'bg-yellow-50 text-yellow-700' },
            { label: 'Sonstige', key: '_other', color: 'bg-purple-50 text-purple-700' },
          ].map((phase) => {
            const count = phase.key === '_other'
              ? Object.entries(phaseCounts)
                  .filter(([k]) => !['draft', 'sent', 'won', 'lost', 'expired'].includes(k))
                  .reduce((sum, [, v]) => sum + v, 0)
              : phaseCounts[phase.key] ?? 0
            return (
              <div key={phase.key} className={`rounded-lg px-4 py-3 text-center ${phase.color}`}>
                <p className="text-xl font-bold">{count}</p>
                <p className="text-[11px] font-medium mt-0.5">{phase.label}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
