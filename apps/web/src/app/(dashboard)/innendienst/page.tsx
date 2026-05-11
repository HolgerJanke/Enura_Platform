export const dynamic = 'force-dynamic'

import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { formatDate } from '@enura/types'
import type { ProjectRow, PhaseDefinitionRow } from '@enura/types'

function PhaseBadge({ name, color }: { name: string; color: string | null }) {
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium border"
      style={{
        borderColor: color ?? '#d1d5db',
        backgroundColor: color ? `${color}15` : '#f9fafb',
        color: color ?? '#6b7280',
      }}
    >
      {name}
    </span>
  )
}

export default async function InnendienstPage() {
  await requirePermission('module:innendienst:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const db = getDataAccess()
  const cid = session.companyId

  const [projects, phaseDefinitions] = await Promise.all([
    db.projects.findMany(cid, { status: 'active' }),
    db.phaseDefinitions.findByCompanyId(cid),
  ])

  const phaseMap = new Map(phaseDefinitions.map((p) => [p.id, p]))
  const sortedPhases = [...phaseDefinitions].sort((a, b) => a.phase_number - b.phase_number)

  // Group projects by phase
  const projectsByPhase = new Map<string, ProjectRow[]>()
  for (const project of projects) {
    const key = project.phase_id ?? 'unassigned'
    const list = projectsByPhase.get(key) ?? []
    list.push(project)
    projectsByPhase.set(key, list)
  }

  // Detect stalled projects
  const stalledProjects = projects.filter((p) => {
    const phase = p.phase_id ? phaseMap.get(p.phase_id) : undefined
    if (!phase?.stall_threshold_days) return false
    const daysSince = Math.floor((Date.now() - new Date(p.phase_entered_at).getTime()) / 86_400_000)
    return daysSince > phase.stall_threshold_days
  })

  // Recent projects (last updated)
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.phase_entered_at).getTime() - new Date(a.phase_entered_at).getTime())
    .slice(0, 15)

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Innendienst / Planung</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Planungsaufträge, Projektfortschritt und Engpässe
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-1">Aktive Projekte</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--brand-kpi-1)' }}>{projects.length}</p>
          <p className="text-xs text-brand-text-secondary mt-1">In Bearbeitung</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-1">Phasen</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--brand-kpi-2)' }}>{sortedPhases.length}</p>
          <p className="text-xs text-brand-text-secondary mt-1">Definierte Prozessschritte</p>
        </div>
        <div className={`rounded-xl p-5 shadow-brand-sm border ${stalledProjects.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${stalledProjects.length > 0 ? 'text-red-600' : 'text-brand-text-secondary'}`}>Verzögert</p>
          <p className={`text-2xl font-bold ${stalledProjects.length > 0 ? 'text-red-700' : 'text-brand-text-primary'}`}>{stalledProjects.length}</p>
          <p className={`text-xs mt-1 ${stalledProjects.length > 0 ? 'text-red-500' : 'text-brand-text-secondary'}`}>Über Schwellenwert</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-1">Ohne Phase</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--brand-kpi-3)' }}>
            {projectsByPhase.get('unassigned')?.length ?? 0}
          </p>
          <p className="text-xs text-brand-text-secondary mt-1">Nicht zugeordnet</p>
        </div>
      </div>

      {/* Phase Overview */}
      <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
        <h2 className="text-base font-semibold text-brand-text-primary mb-4">Phasen-Übersicht</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {sortedPhases.map((phase) => {
            const count = projectsByPhase.get(phase.id)?.length ?? 0
            return (
              <div
                key={phase.id}
                className="rounded-lg border p-3 text-center"
                style={{ borderColor: phase.color ?? '#e5e7eb' }}
              >
                <div
                  className="h-1 rounded-full mb-2 mx-auto w-12"
                  style={{ backgroundColor: phase.color ?? '#d1d5db' }}
                />
                <p className="text-xl font-bold text-brand-text-primary">{count}</p>
                <p className="text-[11px] font-medium text-brand-text-secondary mt-0.5 truncate">
                  {phase.phase_number}. {phase.name}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects Table */}
        <div className="lg:col-span-2 rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-base font-semibold text-brand-text-primary mb-4">Aktuelle Projekte</h2>
          {recentProjects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-brand-text-secondary">Kunde / Projekt</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-brand-text-secondary">Phase</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-brand-text-secondary">Seit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentProjects.map((project) => {
                    const phase = project.phase_id ? phaseMap.get(project.phase_id) : undefined
                    const daysSince = Math.floor((Date.now() - new Date(project.phase_entered_at).getTime()) / 86_400_000)
                    const isStalled = phase?.stall_threshold_days ? daysSince > phase.stall_threshold_days : false

                    return (
                      <tr key={project.id} className={`hover:bg-gray-50/50 transition-colors ${isStalled ? 'bg-red-50/50' : ''}`}>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-brand-text-primary">{project.customer_name}</p>
                          <p className="text-xs text-brand-text-secondary">{project.title}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          {phase ? (
                            <PhaseBadge name={`${phase.phase_number}. ${phase.name}`} color={phase.color} />
                          ) : (
                            <span className="text-xs text-brand-text-secondary">--</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className={`text-sm ${isStalled ? 'text-red-600 font-medium' : 'text-brand-text-secondary'}`}>
                            {daysSince}d
                          </p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-brand-text-secondary">Keine aktiven Projekte.</p>
          )}
        </div>

        {/* Stalled Projects */}
        <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
          <h2 className="text-base font-semibold text-brand-text-primary mb-4">
            Verzögerte Projekte
          </h2>
          {stalledProjects.length > 0 ? (
            <ul className="space-y-3">
              {stalledProjects.slice(0, 10).map((project) => {
                const phase = project.phase_id ? phaseMap.get(project.phase_id) : undefined
                const daysSince = Math.floor((Date.now() - new Date(project.phase_entered_at).getTime()) / 86_400_000)
                return (
                  <li key={project.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-medium text-brand-text-primary">{project.customer_name}</p>
                    <p className="text-xs text-brand-text-secondary mt-0.5">{project.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      <p className="text-[11px] text-red-600 font-medium">
                        {daysSince} Tage in {phase ? `Phase ${phase.phase_number}` : 'unbekannte Phase'}
                        {phase?.stall_threshold_days ? ` (Limit: ${phase.stall_threshold_days}d)` : ''}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-50 mb-3">
                <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-brand-text-secondary">Alle Projekte im Zeitplan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
