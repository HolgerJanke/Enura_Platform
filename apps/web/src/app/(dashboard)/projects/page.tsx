import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { formatNumber, formatDate, KPI_SNAPSHOT_TYPES } from '@enura/types'
import type { ProjectsDailyMetrics } from '@enura/types'
import type { ProjectRow, PhaseDefinitionRow } from '@enura/types'

export default async function ProjectsPage() {
  await requirePermission('module:bau:read')
  const session = await getSession()
  if (!session?.tenantId) return null

  const db = getDataAccess()
  const today = new Date().toISOString().split('T')[0]!

  // Fetch KPI snapshot for summary stats
  const snapshot = await db.kpis.findLatest(
    session.tenantId,
    KPI_SNAPSHOT_TYPES.PROJECTS_DAILY,
  )
  const metrics = snapshot?.metrics as ProjectsDailyMetrics | undefined

  // Fetch live projects and phase definitions for the Kanban view
  const [projects, phaseDefinitions] = await Promise.all([
    db.projects.findMany(session.tenantId, { status: 'active' }),
    db.phaseDefinitions.findByTenantId(session.tenantId),
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
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-brand-text-primary mb-2">
        Bau &amp; Montage &mdash; 27-Phasen Kanban
      </h1>
      <p className="text-brand-text-secondary mb-6">{formatDate(today)}</p>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Aktive Projekte</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.total_active ?? projects.length)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Verzoegert</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.delayed_count ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Blockiert</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.stalled_count ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Abgeschlossen (30 Tage)
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.completed_30d ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Durchschnittl. Durchlaufzeit
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {metrics?.avg_throughput_days !== null &&
            metrics?.avg_throughput_days !== undefined
              ? `${metrics.avg_throughput_days} Tage`
              : '--'}
          </p>
        </div>
      </div>

      {/* Kanban board — horizontal scroll of phases */}
      <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
        <h2 className="text-lg font-medium text-brand-text-primary mb-4">
          Kanban-Board
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {sortedPhases.map((phase) => {
            const phaseProjects = projectsByPhase.get(phase.id) ?? []
            return (
              <div
                key={phase.id}
                className="flex-shrink-0 w-48 rounded-brand border border-gray-300 bg-brand-background p-3"
              >
                <div className="flex items-center gap-2 mb-3">
                  {phase.color && (
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: phase.color }}
                      aria-hidden="true"
                    />
                  )}
                  <p className="text-xs font-medium text-brand-text-secondary truncate">
                    {phase.phase_number}. {phase.name}
                  </p>
                  <span className="ml-auto text-xs text-brand-text-secondary">
                    {phaseProjects.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {phaseProjects.map((project) => {
                    const stalled = isStalledProject(project, phase)
                    return (
                      <div
                        key={project.id}
                        className={`rounded bg-white border p-2 shadow-sm ${
                          stalled
                            ? 'border-red-300 bg-red-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <p className="text-xs font-medium text-brand-text-primary truncate">
                          {project.title}
                        </p>
                        <p className="text-xs text-brand-text-secondary truncate mt-0.5">
                          {project.customer_name}
                        </p>
                        {stalled && (
                          <p className="text-xs text-red-600 mt-1 font-medium">
                            Verzoegert
                          </p>
                        )}
                      </div>
                    )
                  })}
                  {phaseProjects.length === 0 && (
                    <p className="text-xs text-brand-text-secondary italic">
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
        <div className="mt-6 bg-brand-surface rounded-brand p-6 border border-gray-200">
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
