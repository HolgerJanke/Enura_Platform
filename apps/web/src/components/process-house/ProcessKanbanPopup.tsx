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
}

interface Props {
  processId: string
  processName: string
  processType: 'M' | 'P' | 'S'
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  M: 'Management',
  P: 'Kernprozess',
  S: 'Stützprozess',
}

const TYPE_COLORS: Record<string, string> = {
  M: 'bg-teal-100 text-teal-700',
  P: 'bg-green-100 text-green-700',
  S: 'bg-sky-100 text-sky-700',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessKanbanPopup({ processId, processName, processType, onClose }: Props) {
  const [steps, setSteps] = useState<ProcessStep[]>([])
  const [loading, setLoading] = useState(true)

  // Escape key handler
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

  // Fetch process steps
  useEffect(() => {
    async function fetchSteps() {
      try {
        const res = await fetch(`/api/process-house/steps?processId=${processId}`)
        if (res.ok) {
          const data = await res.json()
          setSteps(data.steps ?? [])
        }
      } catch {
        // Fallback: empty
      }
      setLoading(false)
    }
    fetchSteps()
  }, [processId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
        aria-label="Schließen"
      />

      {/* Popup */}
      <div className="relative z-10 w-full max-w-5xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${TYPE_COLORS[processType]}`}>
              {processType}
            </span>
            <h2 className="text-lg font-bold text-gray-900">{processName}</h2>
            <span className="text-xs text-gray-400">{TYPE_LABELS[processType]}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Schließen"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Kanban body */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-500">Schritte werden geladen...</p>
            </div>
          ) : steps.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-500">Keine Schritte für diesen Prozess definiert.</p>
            </div>
          ) : (
            <div className="flex gap-4 min-w-max">
              {steps.map((step, i) => (
                <div
                  key={step.id}
                  className="w-56 flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50"
                >
                  {/* Column header */}
                  <div className="border-b border-gray-200 bg-white px-3 py-2.5 rounded-t-lg">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {step.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{step.process_step_id}</p>
                  </div>

                  {/* Column body — placeholder for project cards */}
                  <div className="p-3 min-h-[120px]">
                    {step.description ? (
                      <p className="text-xs text-gray-500">{step.description}</p>
                    ) : (
                      <p className="text-xs text-gray-300 italic">Keine Beschreibung</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
