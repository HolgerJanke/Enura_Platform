'use client'

import { useState, useEffect, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProcessStep {
  id: string
  name: string
  process_step_id: string
  sort_order: number
  description: string
  responsible_roles: string[]
  phase_id: string | null
  expected_output: string | null
  criticality: string | null
  rhythm: string | null
}

interface ProcessPhase {
  id: string
  name: string
  description: string | null
  sort_order: number
  color: string | null
}

interface ProjectCard {
  id: string
  title: string
  customer_name: string
  address_city: string | null
  status: string
  project_value: number | null
}

interface Props {
  processId: string
  processName: string
  processType: 'M' | 'P' | 'S'
  filterPhaseId?: string | null
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = { M: 'Management', P: 'Kernprozess', S: 'Stützprozess' }
const TYPE_COLORS: Record<string, string> = { M: 'bg-teal-100 text-teal-700', P: 'bg-green-100 text-green-700', S: 'bg-sky-100 text-sky-700' }
const CRIT_COLORS: Record<string, string> = { A: 'bg-red-100 text-red-700', B: 'bg-amber-100 text-amber-700', C: 'bg-gray-100 text-gray-500' }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessKanbanPopup({ processId, processName, processType, filterPhaseId, onClose }: Props) {
  const [steps, setSteps] = useState<ProcessStep[]>([])
  const [phases, setPhases] = useState<ProcessPhase[]>([])
  const [projectsByStep, setProjectsByStep] = useState<Record<string, ProjectCard[]>>({})
  const [currency, setCurrency] = useState('CHF')
  const [loading, setLoading] = useState(true)

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [handleEscape])

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/process-house/steps?processId=${processId}`)
        if (res.ok) {
          const data = await res.json()
          setSteps(data.steps ?? [])
          setPhases(data.phases ?? [])
          setProjectsByStep(data.projectsByStep ?? {})
          if (data.baseCurrency) setCurrency(data.baseCurrency)
        }
      } catch { /* empty */ }
      setLoading(false)
    }
    fetchData()
  }, [processId])

  // Filter steps by phase if filterPhaseId is set
  const displaySteps = filterPhaseId
    ? steps.filter(s => s.phase_id === filterPhaseId)
    : steps

  const filteredPhaseName = filterPhaseId
    ? phases.find(p => p.id === filterPhaseId)?.name
    : null

  const totalProjects = Object.values(projectsByStep).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} aria-label="Schließen" />

      <div className="relative z-10 w-full max-w-[95vw] max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold shrink-0 ${TYPE_COLORS[processType]}`}>{processType}</span>
            <h2 className="text-base font-bold text-gray-900 truncate">
              {processName}
              {filteredPhaseName && <span className="text-gray-400 font-normal"> — {filteredPhaseName}</span>}
            </h2>
            <span className="text-xs text-gray-400 shrink-0">{TYPE_LABELS[processType]}</span>
            <span className="text-xs text-gray-400 shrink-0">· {displaySteps.length} Schritte · {totalProjects} Projekte</span>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 shrink-0" aria-label="Schließen">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Kanban body */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><p className="text-sm text-gray-500">Wird geladen...</p></div>
          ) : displaySteps.length === 0 ? (
            <div className="flex items-center justify-center py-12"><p className="text-sm text-gray-500">Keine Schritte definiert.</p></div>
          ) : (
            <div className="flex gap-3" style={{ minWidth: `${displaySteps.length * 220}px` }}>
              {displaySteps.map((step) => {
                const cards = projectsByStep[step.id] ?? []
                const isLink = step.expected_output?.startsWith('/')
                const columnTotal = cards.reduce((sum, p) => sum + Number(p.project_value ?? 0), 0)

                return (
                  <div key={step.id} className="w-52 shrink-0 flex flex-col rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                    {/* Column header */}
                    <div
                      className={`border-b border-gray-200 bg-white px-3 py-2.5 ${isLink ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                      onClick={isLink ? () => { window.location.href = step.expected_output! } : undefined}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-semibold truncate ${isLink ? 'text-blue-600' : 'text-gray-900'}`}>
                          {step.name}
                        </span>
                        {step.criticality && (
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold shrink-0 ${CRIT_COLORS[step.criticality] ?? ''}`}>
                            {step.criticality}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-400 font-mono">{step.process_step_id}</span>
                        <span className="text-[10px] text-gray-400">{cards.length} Projekte</span>
                      </div>
                      {columnTotal > 0 && (
                        <p className="text-[10px] font-semibold text-green-700 mt-1">
                          {currency} {columnTotal.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      )}
                    </div>

                    {/* Project cards */}
                    <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[50vh]">
                      {cards.length === 0 ? (
                        <p className="text-[10px] text-gray-300 text-center py-4">—</p>
                      ) : (
                        cards.map((proj) => (
                          <a
                            key={proj.id}
                            href={`/projects/${proj.id}?from=${processId}&name=${encodeURIComponent(processName)}${filterPhaseId ? `&phase=${filterPhaseId}` : ''}`}
                            className="block rounded-md border border-gray-200 bg-white px-2.5 py-2 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                          >
                            <p className="text-xs font-medium text-blue-700 truncate">{proj.customer_name}</p>
                            {proj.address_city && (
                              <p className="text-[10px] text-gray-400 truncate">{proj.address_city}</p>
                            )}
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
