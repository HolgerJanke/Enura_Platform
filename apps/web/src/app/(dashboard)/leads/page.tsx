export const dynamic = 'force-dynamic'

import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import { formatDate } from '@enura/types'
import type { LeadRow, TeamMemberRow } from '@enura/types'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Phase badge
// ---------------------------------------------------------------------------

function PhaseBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    new: { label: 'Neuer Lead', cls: 'bg-green-50 text-green-700 border-green-200' },
    contacted: { label: 'Kontaktiert', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    qualified: { label: 'Qualifiziert', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
    appointment_set: { label: 'Termin gebucht', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    appointment_booked: { label: 'Termin gebucht', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    won: { label: 'Gewonnen', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    lost: { label: 'Verloren', cls: 'bg-red-50 text-red-700 border-red-200' },
    disqualified: { label: 'Disqualifiziert', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
    angebot_versendet: { label: 'Angebot versendet', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    erstgespraech: { label: 'Erstgespräch', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    follow_up: { label: 'Follow-up', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    verhandlung: { label: 'Verhandlung', cls: 'bg-pink-50 text-pink-700 border-pink-200' },
  }
  const info = map[status] ?? { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200' }
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${info.cls}`}>
      {info.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Pagination component
// ---------------------------------------------------------------------------

function Pagination({ page, totalPages, basePath }: { page: number; totalPages: number; basePath: string }) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      {page > 1 && (
        <Link
          href={`${basePath}?page=${page - 1}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-text-secondary hover:bg-gray-100 transition-colors"
        >
          ← Zurück
        </Link>
      )}
      {pages.map((p, idx) =>
        p === '...' ? (
          <span key={`dots-${idx}`} className="px-2 text-brand-text-secondary">…</span>
        ) : (
          <Link
            key={p}
            href={`${basePath}?page=${p}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              p === page
                ? 'bg-brand-primary text-white'
                : 'text-brand-text-secondary hover:bg-gray-100'
            }`}
          >
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link
          href={`${basePath}?page=${page + 1}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-text-secondary hover:bg-gray-100 transition-colors"
        >
          Weiter →
        </Link>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  await requirePermission('module:leads:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const page = Math.max(1, parseInt(String(sp.page ?? '1'), 10) || 1)
  const pageSize = 50

  const db = getDataAccess()

  const svc = createSupabaseServiceClient()

  // Parallel: paginated leads + counts + team members
  const [result, totalLeads, wonLeads, lostLeads, teamMembers, assignedResult, withOfferResult] = await Promise.all([
    db.leads.findPaginated(session.companyId, { page, pageSize }),
    db.leads.count(session.companyId),
    db.leads.count(session.companyId, { status: 'won' }),
    db.leads.count(session.companyId, { status: 'lost' }),
    db.teamMembers.findByCompanyId(session.companyId),
    svc.from('leads').select('*', { count: 'exact', head: true }).eq('company_id', session.companyId).not('setter_id', 'is', null),
    svc.from('offers').select('lead_id', { count: 'exact', head: true }).eq('company_id', session.companyId).not('lead_id', 'is', null),
  ])
  const openLeads = totalLeads - wonLeads - lostLeads
  const assignedLeads = assignedResult.count ?? 0
  const leadsWithOffer = withOfferResult.count ?? 0

  const { data: leads, totalPages } = result
  const memberMap = new Map(teamMembers.map((m: TeamMemberRow) => [m.id, m]))

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Vertrieb & Akquise</h1>
          <p className="text-sm text-brand-text-secondary mt-1">Lead-Pipeline und Vertriebsübersicht</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Offene Leads', value: openLeads, color: '--brand-kpi-1' },
          { label: 'Zugewiesen', value: assignedLeads, color: '--brand-kpi-2' },
          { label: 'Mit Angebot', value: leadsWithOffer, color: '--brand-kpi-3' },
          { label: 'Total Leads', value: totalLeads, color: '--brand-kpi-1' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100">
            <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: `var(${kpi.color})` }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Lead Pipeline Table */}
      <div className="rounded-xl bg-white shadow-brand-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-brand-text-primary">Lead-Pipeline</h2>
          <p className="text-xs text-brand-text-secondary">
            {totalLeads > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalLeads)} von ${totalLeads}` : '0 Leads'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-secondary">Name / Adresse</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-brand-text-secondary">Quelle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-brand-text-secondary">Phase</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-brand-text-secondary">Zugewiesen</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-brand-text-secondary">Erstellt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead: LeadRow) => {
                const assigned = lead.setter_id ? memberMap.get(lead.setter_id) : null
                const assignedName = assigned
                  ? `${assigned.first_name ?? ''} ${assigned.last_name ?? ''}`.trim()
                  : '—'
                const assignedInitials = assigned
                  ? `${(assigned.first_name ?? '')[0] ?? ''}${(assigned.last_name ?? '')[0] ?? ''}`.toUpperCase()
                  : ''

                return (
                  <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-3">
                      <Link href={`/leads/${lead.id}`} className="block">
                        <p className="font-medium text-brand-text-primary group-hover:text-brand-primary transition-colors">
                          {`${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'Unbekannt'}
                        </p>
                        <p className="text-xs text-brand-text-secondary">
                          {[lead.address_street, lead.address_zip, lead.address_city].filter(Boolean).join(', ') || '—'}
                        </p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-brand-text-secondary capitalize">
                      {(lead.source ?? 'unbekannt').replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <PhaseBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3">
                      {assigned ? (
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary/10 text-[10px] font-semibold text-brand-primary">
                            {assignedInitials}
                          </span>
                          <span className="text-sm text-brand-text-primary">{assignedName}</span>
                        </div>
                      ) : (
                        <span className="text-brand-text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-brand-text-secondary">
                      {formatDate(lead.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {leads.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-brand-text-secondary">Keine Leads vorhanden.</p>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} basePath="/leads" />
      </div>
    </div>
  )
}
