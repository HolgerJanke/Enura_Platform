export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { formatNumber, formatDate, KPI_SNAPSHOT_TYPES } from '@enura/types'
import type { ProjectsDailyMetrics } from '@enura/types'
import type { ProjectRow, PhaseDefinitionRow, OfferRow, TeamMemberRow } from '@enura/types'

// Offer-status pipeline columns when no projects exist
const OFFER_PIPELINE_PHASES = [
  { key: 'draft', label: 'Entwurf', color: '#94a3b8' },
  { key: 'sent', label: 'Versendet', color: '#3b82f6' },
  { key: 'won', label: 'Gewonnen', color: '#22c55e' },
  { key: 'lost', label: 'Verloren', color: '#ef4444' },
  { key: 'expired', label: 'Abgelaufen', color: '#f59e0b' },
] as const

export default async function ProjectsPage() {
  await requirePermission('module:bau:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const db = getDataAccess()
  const today = new Date().toISOString().split('T')[0]!

  // Fetch KPI snapshot for summary stats
  const snapshot = await db.kpis.findLatest(
    session.companyId,
    KPI_SNAPSHOT_TYPES.PROJECTS_DAILY,
  )
  const metrics = snapshot?.metrics as ProjectsDailyMetrics | undefined

  // Fetch live projects and phase definitions for the Kanban view
  const [projects, phaseDefinitions] = await Promise.all([
    db.projects.findMany(session.companyId, { status: 'active' }),
    db.phaseDefinitions.findByCompanyId(session.companyId),
  ])

  const hasProjects = projects.length > 0

  // If no projects exist, fetch offers + leads for a pipeline view
  let offers: OfferRow[] = []
  let teamMembers: TeamMemberRow[] = []
  let wonCount = 0
  let sentCount = 0
  let draftCount = 0
  let lostCount = 0
  let expiredCount = 0
  let pipelineTotal = 0

  if (!hasProjects) {
    const [allOffers, tm, wc, sc, dc, lc, ec, pt] = await Promise.all([
      db.offers.findMany(session.companyId),
      db.teamMembers.findByCompanyId(session.companyId),
      db.offers.count(session.companyId, { status: 'won' }),
      db.offers.count(session.companyId, { status: 'sent' }),
      db.offers.count(session.companyId, { status: 'draft' }),
      db.offers.count(session.companyId, { status: 'lost' }),
      db.offers.count(session.companyId, { status: 'expired' }),
      db.offers.sumAmountChf(session.companyId, { excludeStatus: ['lost', 'expired'] }),
    ])
    offers = allOffers
    teamMembers = tm
    wonCount = wc
    sentCount = sc
    draftCount = dc
    lostCount = lc
    expiredCount = ec
    pipelineTotal = pt
  }

  // --- Projects-based Kanban ---
  const sortedPhases = [...phaseDefinitions].sort(
    (a, b) => a.phase_number - b.phase_number,
  )
  const projectsByPhase = new Map<string, ProjectRow[]>()
  for (const project of projects) {
    const phaseId = project.phase_id ?? 'unassigned'
    const existing = projectsByPhase.get(phaseId) ?? []
    existing.push(project)
    projectsByPhase.set(phaseId, existing)
  }

  function isStalledProject(
    project: ProjectRow,
    phase: PhaseDefinitionRow | undefined,
  ): boolean {
    if (!phase?.stall_threshold_days) return false
    const enteredAt = new Date(project.phase_entered_at)
    const now = new Date()
    const daysSinceEntry = Math.floor(
      (now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24),
    )
    return daysSinceEntry > phase.stall_threshold_days
  }

  // --- Offer-based Kanban helpers ---
  const offersByStatus = new Map<string, OfferRow[]>()
  for (const offer of offers) {
    const existing = offersByStatus.get(offer.status) ?? []
    existing.push(offer)
    offersByStatus.set(offer.status, existing)
  }
  const memberMap = new Map(teamMembers.map((m) => [m.id, m]))

  // Compute stats for offer-based view
  const totalActive = hasProjects ? (metrics?.total_active ?? projects.length) : (draftCount + sentCount + wonCount)
  const totalWon = hasProjects ? (metrics?.completed_30d ?? 0) : wonCount
  const totalDelayed = hasProjects ? (metrics?.delayed_count ?? 0) : expiredCount
  const totalStalled = hasProjects ? (metrics?.stalled_count ?? 0) : lostCount
  const pipelineValue = hasProjects
    ? (metrics?.avg_throughput_days !== null && metrics?.avg_throughput_days !== undefined ? `${metrics.avg_throughput_days}d` : '--')
    : (pipelineTotal > 1_000_000
        ? `CHF ${(pipelineTotal / 1_000_000).toFixed(1)}M`
        : pipelineTotal > 0
          ? `CHF ${Math.round(pipelineTotal).toLocaleString('de-CH')}`
          : 'CHF 0')

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Projektmanagement</h1>
          <p className="text-sm text-brand-text-secondary mt-1">{formatDate(today)}</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-white border border-gray-200 p-1">
          {['Kanban', 'Liste', 'Gantt'].map((tab, i) => (
            <button
              key={tab}
              type="button"
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                i === 0 ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-xl bg-white p-4 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">
            {hasProjects ? 'Aktive Projekte' : 'Angebote aktiv'}
          </p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">
            {formatNumber(totalActive)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">
            {hasProjects ? 'Verzögert' : 'Abgelaufen'}
          </p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            {formatNumber(totalDelayed)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">
            {hasProjects ? 'Blockiert' : 'Verloren'}
          </p>
          <p className="text-2xl font-bold text-yellow-500 mt-1">
            {formatNumber(totalStalled)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">
            {hasProjects ? 'Abgeschlossen (30d)' : 'Gewonnen'}
          </p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatNumber(totalWon)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">
            {hasProjects ? 'Durchlaufzeit' : 'Pipeline-Wert'}
          </p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">
            {pipelineValue}
          </p>
        </div>
      </div>

      {/* Kanban board — full width, no horizontal scroll */}
      <div className="rounded-xl bg-white p-3 shadow-brand-sm border border-gray-100">
        {hasProjects ? (
          /* Phase-based Kanban from projects table */
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${sortedPhases.length}, minmax(0, 1fr))` }}>
            {sortedPhases.map((phase) => {
              const phaseProjects = projectsByPhase.get(phase.id) ?? []
              return (
                <div key={phase.id} className="min-w-0">
                  <div className="mb-2">
                    <div
                      className="h-1 rounded-full mb-1.5"
                      style={{ backgroundColor: phase.color ?? 'var(--brand-primary)' }}
                    />
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] font-semibold text-brand-text-primary truncate">
                        {phase.phase_number}. {phase.name}
                      </p>
                      <span className="flex-shrink-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gray-100 px-1 text-[9px] font-semibold text-brand-text-secondary">
                        {phaseProjects.length}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-0.5">
                    {phaseProjects.map((project) => {
                      const stalled = isStalledProject(project, phase)
                      return (
                        <Link
                          key={project.id}
                          href={`/projects/${project.id}`}
                          className={`block rounded-md bg-brand-background border p-2 shadow-brand-sm hover:shadow-brand-md transition-shadow ${
                            stalled ? 'border-red-200 bg-red-50' : 'border-gray-100'
                          }`}
                        >
                          <p className="text-xs font-medium text-brand-text-primary truncate">
                            {project.customer_name}
                          </p>
                          {project.title !== project.customer_name && (
                            <p className="text-[10px] text-brand-text-secondary truncate mt-0.5">
                              {project.title}
                            </p>
                          )}
                          {stalled && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              <p className="text-[10px] text-red-600 font-medium">Verzögert</p>
                            </div>
                          )}
                        </Link>
                      )
                    })}
                    {phaseProjects.length === 0 && (
                      <p className="text-[10px] text-brand-text-secondary italic text-center py-3">
                        Keine Projekte
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Offer-based pipeline Kanban — full width */
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${OFFER_PIPELINE_PHASES.length}, minmax(0, 1fr))` }}>
            {OFFER_PIPELINE_PHASES.map((phase) => {
              const phaseOffers = offersByStatus.get(phase.key) ?? []
              return (
                <div key={phase.key} className="min-w-0">
                  <div className="mb-2">
                    <div
                      className="h-1 rounded-full mb-1.5"
                      style={{ backgroundColor: phase.color }}
                    />
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] font-semibold text-brand-text-primary truncate">
                        {phase.label}
                      </p>
                      <span className="flex-shrink-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gray-100 px-1 text-[9px] font-semibold text-brand-text-secondary">
                        {phaseOffers.length}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-0.5">
                    {phaseOffers.slice(0, 30).map((offer) => {
                      const berater = offer.berater_id ? memberMap.get(offer.berater_id) : null
                      const beraterName = berater
                        ? `${berater.first_name ?? ''} ${berater.last_name ?? ''}`.trim()
                        : null
                      const amount = Number(offer.amount_chf) || 0
                      return (
                        <Link
                          key={offer.id}
                          href={offer.lead_id ? `/leads/${offer.lead_id}` : '#'}
                          className="block rounded-md bg-brand-background border border-gray-100 p-2 shadow-brand-sm hover:shadow-brand-md transition-shadow"
                        >
                          <p className="text-xs font-medium text-brand-text-primary truncate">
                            {offer.title || 'Ohne Titel'}
                          </p>
                          {amount > 0 && (
                            <p className="text-[10px] font-semibold text-brand-text-primary mt-0.5">
                              CHF {amount.toLocaleString('de-CH')}
                            </p>
                          )}
                          {beraterName && (
                            <p className="text-[10px] text-brand-text-secondary mt-0.5 truncate">
                              {beraterName}
                            </p>
                          )}
                        </Link>
                      )
                    })}
                    {phaseOffers.length > 30 && (
                      <p className="text-[10px] text-brand-text-secondary text-center py-1.5">
                        +{phaseOffers.length - 30} weitere
                      </p>
                    )}
                    {phaseOffers.length === 0 && (
                      <p className="text-[10px] text-brand-text-secondary italic text-center py-3">
                        Keine Angebote
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Phase distribution table (from snapshot) */}
      {metrics?.by_phase && Object.keys(metrics.by_phase).length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Projekte pro Phase (Snapshot)
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 text-left text-brand-text-secondary font-medium">Phase</th>
                <th className="py-2 text-right text-brand-text-secondary font-medium">Anzahl</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.by_phase)
                .sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true }))
                .map(([phaseName, count]) => (
                  <tr key={phaseName} className="border-b border-gray-100">
                    <td className="py-2 text-brand-text-primary">{phaseName}</td>
                    <td className="py-2 text-right font-medium text-brand-text-primary">
                      {formatNumber(count)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Offer-based pipeline summary table */}
      {!hasProjects && offers.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Angebote nach Status
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 text-left text-brand-text-secondary font-medium">Status</th>
                <th className="py-2 text-right text-brand-text-secondary font-medium">Anzahl</th>
                <th className="py-2 text-right text-brand-text-secondary font-medium">Volumen (CHF)</th>
              </tr>
            </thead>
            <tbody>
              {OFFER_PIPELINE_PHASES.map((phase) => {
                const phaseOffers = offersByStatus.get(phase.key) ?? []
                const volume = phaseOffers.reduce((s, o) => s + (Number(o.amount_chf) || 0), 0)
                return (
                  <tr key={phase.key} className="border-b border-gray-100">
                    <td className="py-2 text-brand-text-primary flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: phase.color }} />
                      {phase.label}
                    </td>
                    <td className="py-2 text-right font-medium text-brand-text-primary">
                      {formatNumber(phaseOffers.length)}
                    </td>
                    <td className="py-2 text-right font-medium text-brand-text-primary">
                      {volume > 0 ? `CHF ${volume.toLocaleString('de-CH')}` : '--'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
