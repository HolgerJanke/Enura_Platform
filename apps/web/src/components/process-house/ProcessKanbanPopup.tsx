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
}

interface ProcessPhase {
  id: string
  name: string
  description: string | null
  sort_order: number
  color: string | null
}

interface Props {
  processId: string
  processName: string
  processType: 'M' | 'P' | 'S'
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = { M: 'Management', P: 'Kernprozess', S: 'Stützprozess' }
const TYPE_COLORS: Record<string, string> = { M: 'bg-teal-100 text-teal-700', P: 'bg-green-100 text-green-700', S: 'bg-sky-100 text-sky-700' }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessKanbanPopup({ processId, processName, processType, onClose }: Props) {
  const [steps, setSteps] = useState<ProcessStep[]>([])
  const [phases, setPhases] = useState<ProcessPhase[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())

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
          // Expand all phases by default
          setExpandedPhases(new Set((data.phases ?? []).map((p: ProcessPhase) => p.id)))
        }
      } catch { /* empty */ }
      setLoading(false)
    }
    fetchData()
  }, [processId])

  function togglePhase(phaseId: string) {
    setExpandedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(phaseId)) next.delete(phaseId)
      else next.add(phaseId)
      return next
    })
  }

  // Group steps by phase
  const stepsByPhase = new Map<string | null, ProcessStep[]>()
  for (const step of steps) {
    const key = step.phase_id
    const arr = stepsByPhase.get(key) ?? []
    arr.push(step)
    stepsByPhase.set(key, arr)
  }

  const unphased = stepsByPhase.get(null) ?? []
  const hasPhases = phases.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} aria-label="Schließen" />

      <div className="relative z-10 w-full max-w-5xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${TYPE_COLORS[processType]}`}>{processType}</span>
            <h2 className="text-lg font-bold text-gray-900">{processName}</h2>
            <span className="text-xs text-gray-400">{TYPE_LABELS[processType]}</span>
            <span className="text-xs text-gray-400">· {steps.length} Schritte</span>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Schließen">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12"><p className="text-sm text-gray-500">Wird geladen...</p></div>
          ) : steps.length === 0 ? (
            <div className="flex items-center justify-center py-12"><p className="text-sm text-gray-500">Keine Schritte definiert.</p></div>
          ) : hasPhases ? (
            /* Phase-grouped view */
            <div className="space-y-4">
              {phases.map((phase, phaseIdx) => {
                const phaseSteps = stepsByPhase.get(phase.id) ?? []
                const isExpanded = expandedPhases.has(phase.id)

                return (
                  <div key={phase.id} className="rounded-lg border border-gray-200 overflow-hidden">
                    {/* Phase header */}
                    <button
                      type="button"
                      onClick={() => togglePhase(phase.id)}
                      className="flex w-full items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {phase.color && (
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: phase.color }} />
                        )}
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          Phase {phaseIdx + 1}: {phase.name}
                        </span>
                        <span className="text-xs text-gray-400">{phaseSteps.length} Schritte</span>
                      </div>
                      <svg className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Phase steps table */}
                    {isExpanded && (
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead>
                          <tr className="bg-gray-800 text-white">
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Nr.</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Prozess</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Funktion</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {phaseSteps.map((step) => (
                            <tr key={step.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-sm font-mono text-blue-600">{step.process_step_id}</td>
                              <td className="px-4 py-2.5 text-sm text-gray-900">{step.name}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {(step.responsible_roles ?? []).map((role) => (
                                    <span key={role} className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{role}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}

              {/* Unphased steps */}
              {unphased.length > 0 && (
                <div className="rounded-lg border border-dashed border-gray-300">
                  <div className="px-5 py-3 bg-gray-50">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Nicht zugeordnet</span>
                  </div>
                  <table className="min-w-full divide-y divide-gray-100">
                    <tbody className="divide-y divide-gray-100">
                      {unphased.map((step) => (
                        <tr key={step.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-sm font-mono text-gray-500 w-20">{step.process_step_id}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-900">{step.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Flat view (no phases) */
            <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200 overflow-hidden">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Nr.</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Prozess</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Funktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {steps.map((step) => (
                  <tr key={step.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-mono text-blue-600">{step.process_step_id}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-900">{step.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(step.responsible_roles ?? []).map((role) => (
                          <span key={role} className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{role}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
