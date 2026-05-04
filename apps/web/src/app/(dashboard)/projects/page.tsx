export const dynamic = 'force-dynamic'

import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { formatNumber, formatDate, KPI_SNAPSHOT_TYPES } from '@enura/types'
import type { ProjectsDailyMetrics } from '@enura/types'
import type { ProjectRow, PhaseDefinitionRow } from '@enura/types'

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

  // Sort phases by phase_number
  const sortedPhases = [...phaseDefinitions].sort(
    (a, b) => a.phase_number - b.phase_number,
  )

  // Group projects by phase_id
  const projectsByPhase = new Map<string, ProjectRow[]>()
  for (const project of projects) {
    const phaseId = project.phase_id ?? 'unassigned'
    const existing = projectsByPhase.get(phaseId) ?? []
    existing.push(project)
    projectsByPhase.set(phaseId, existing)
  }

  // Detect stalled projects (phase_entered_at older than threshold)
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
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">Aktive Projekte</p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">
            {formatNumber(metrics?.total_active ?? projects.length)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">Verzögert</p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            {formatNumber(metrics?.delayed_count ?? 0)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">Blockiert</p>
          <p className="text-2xl font-bold text-yellow-500 mt-1">
            {formatNumber(metrics?.stalled_count ?? 0)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">Abgeschlossen (30d)</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatNumber(metrics?.completed_30d ?? 0)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">Durchlaufzeit</p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">
            {metrics?.avg_throughput_days !== null &&
            metrics?.avg_throughput_days !== undefined
              ? `${metrics.avg_throughput_days}d`
              : '--'}
          </p>
        </div>
      </div>

      {/* Kanban board — horizontal scroll of phases */}
      <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {sortedPhases.map((phase) => {
            const phaseProjects = projectsByPhase.get(phase.id) ?? []
            return (
              <div
                key={phase.id}
                className="flex-shrink-0 w-52"
              >
                {/* Phase header with color bar */}
                <div className="mb-3">
                  <div
                    className="h-1 rounded-full mb-2"
                    style={{ backgroundColor: phase.color ?? 'var(--brand-primary)' }}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-brand-text-primary truncate">
                      {phase.phase_number}. {phase.name}
                    </p>
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-brand-text-secondary">
                      {phaseProjects.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {phaseProjects.map((project) => {
                    const stalled = isStalledProject(project, phase)
                    return (
                      <div
                        key={project.id}
                        className={`rounded-lg bg-brand-background border p-3 shadow-brand-sm hover:shadow-brand-md transition-shadow cursor-pointer ${
                          stalled
                            ? 'border-red-200 bg-red-50'
                            : 'border-gray-100'
                        }`}
                      >
                        <p className="text-sm font-medium text-brand-text-primary truncate">
                          {project.customer_name}
                        </p>
                        <p className="text-xs text-brand-text-secondary truncate mt-0.5">
                          {project.title}
                        </p>
                        {stalled && (
                          <div className="flex items-center gap-1 mt-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            <p className="text-[10px] text-red-600 font-medium">Verzögert</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {phaseProjects.length === 0 && (
                    <p className="text-xs text-brand-text-secondary italic text-center py-4">
                      Keine Projekte
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Phase distribution table */}
      {metrics?.by_phase && Object.keys(metrics.by_phase).length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Projekte pro Phase (Snapshot)
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 text-left text-brand-text-secondary font-medium">
                  Phase
                </th>
                <th className="py-2 text-right text-brand-text-secondary font-medium">
                  Anzahl
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.by_phase)
                .sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true }))
                .map(([phaseName, count]) => (
                  <tr key={phaseName} className="border-b border-gray-100">
                    <td className="py-2 text-brand-text-primary">
                      {phaseName}
                    </td>
                    <td className="py-2 text-right font-medium text-brand-text-primary">
                      {formatNumber(count)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
