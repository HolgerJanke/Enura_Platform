'use client'

import { useState, useCallback, useTransition } from 'react'
import { saveRedactionalEdits } from './actions'
import type { EnrichedStep } from './page'
import type { SaveRedactionalEditsInput } from './actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepDraft {
  description: string
  expected_output: string
  show_in_flowchart: boolean
}

interface SourceDraft {
  label: string
  tool_name: string
  endpoint: string
}

interface InterfaceDraft {
  label: string
  endpoint: string
}

interface EditModeProps {
  processId: string
  steps: EnrichedStep[]
  viewMode: 'flowchart' | 'liste'
  onStepClick?: (stepId: string) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  super_user: 'Super User',
  geschaeftsfuehrung: 'Geschäftsführung',
  teamleiter: 'Teamleiter',
  setter: 'Setter',
  berater: 'Berater',
  innendienst: 'Innendienst',
  bau: 'Bau / Montage',
  buchhaltung: 'Buchhaltung',
  leadkontrolle: 'Leadkontrolle',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditMode({
  processId,
  steps,
  viewMode,
  onStepClick,
}: EditModeProps) {
  const [isPending, startTransition] = useTransition()
  const [changeNote, setChangeNote] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Track edits per step
  const [stepDrafts, setStepDrafts] = useState<Record<string, StepDraft>>(() => {
    const initial: Record<string, StepDraft> = {}
    for (const step of steps) {
      initial[step.id] = {
        description: step.description ?? '',
        expected_output: step.expected_output ?? '',
        show_in_flowchart: step.show_in_flowchart,
      }
    }
    return initial
  })

  // Track source edits
  const [sourceDrafts, setSourceDrafts] = useState<Record<string, SourceDraft>>(() => {
    const initial: Record<string, SourceDraft> = {}
    for (const step of steps) {
      for (const src of step.sources) {
        initial[src.id] = {
          label: src.label,
          tool_name: src.tool_name ?? '',
          endpoint: src.endpoint ?? '',
        }
      }
    }
    return initial
  })

  // Track interface edits
  const [interfaceDrafts, setInterfaceDrafts] = useState<Record<string, InterfaceDraft>>(() => {
    const initial: Record<string, InterfaceDraft> = {}
    for (const step of steps) {
      for (const iface of step.interfaces) {
        initial[iface.id] = {
          label: iface.label,
          endpoint: iface.endpoint ?? '',
        }
      }
    }
    return initial
  })

  const updateStepDraft = useCallback(
    (stepId: string, field: keyof StepDraft, value: string | boolean) => {
      setStepDrafts((prev) => ({
        ...prev,
        [stepId]: { ...prev[stepId], [field]: value } as StepDraft,
      }))
    },
    [],
  )

  const updateSourceDraft = useCallback(
    (sourceId: string, field: keyof SourceDraft, value: string) => {
      setSourceDrafts((prev) => ({
        ...prev,
        [sourceId]: { ...prev[sourceId], [field]: value } as SourceDraft,
      }))
    },
    [],
  )

  const updateInterfaceDraft = useCallback(
    (ifaceId: string, field: keyof InterfaceDraft, value: string) => {
      setInterfaceDrafts((prev) => ({
        ...prev,
        [ifaceId]: { ...prev[ifaceId], [field]: value } as InterfaceDraft,
      }))
    },
    [],
  )

  // Compute changed fields
  const getChangedStepEdits = useCallback(() => {
    const edits: SaveRedactionalEditsInput['stepEdits'] = []
    for (const step of steps) {
      const draft = stepDrafts[step.id]
      if (!draft) continue
      const changes: Record<string, unknown> = {}
      if (draft.description !== (step.description ?? '')) {
        changes['description'] = draft.description
      }
      if (draft.expected_output !== (step.expected_output ?? '')) {
        changes['expected_output'] = draft.expected_output || null
      }
      if (draft.show_in_flowchart !== step.show_in_flowchart) {
        changes['show_in_flowchart'] = draft.show_in_flowchart
      }
      if (Object.keys(changes).length > 0) {
        edits.push({ stepId: step.id, ...changes } as SaveRedactionalEditsInput['stepEdits'][0])
      }
    }
    return edits
  }, [steps, stepDrafts])

  const getChangedSourceEdits = useCallback(() => {
    const edits: SaveRedactionalEditsInput['sourceEdits'] = []
    for (const step of steps) {
      for (const src of step.sources) {
        const draft = sourceDrafts[src.id]
        if (!draft) continue
        const changes: Record<string, unknown> = {}
        if (draft.label !== src.label) changes['label'] = draft.label
        if (draft.tool_name !== (src.tool_name ?? '')) changes['tool_name'] = draft.tool_name || null
        if (draft.endpoint !== (src.endpoint ?? '')) changes['endpoint'] = draft.endpoint || null
        if (Object.keys(changes).length > 0) {
          edits.push({ sourceId: src.id, ...changes } as SaveRedactionalEditsInput['sourceEdits'][0])
        }
      }
    }
    return edits
  }, [steps, sourceDrafts])

  const getChangedInterfaceEdits = useCallback(() => {
    const edits: SaveRedactionalEditsInput['interfaceEdits'] = []
    for (const step of steps) {
      for (const iface of step.interfaces) {
        const draft = interfaceDrafts[iface.id]
        if (!draft) continue
        const changes: Record<string, unknown> = {}
        if (draft.label !== iface.label) changes['label'] = draft.label
        if (draft.endpoint !== (iface.endpoint ?? '')) changes['endpoint'] = draft.endpoint || null
        if (Object.keys(changes).length > 0) {
          edits.push({ interfaceId: iface.id, ...changes } as SaveRedactionalEditsInput['interfaceEdits'][0])
        }
      }
    }
    return edits
  }, [steps, interfaceDrafts])

  const hasChanges = useCallback(() => {
    return (
      getChangedStepEdits().length > 0 ||
      getChangedSourceEdits().length > 0 ||
      getChangedInterfaceEdits().length > 0
    )
  }, [getChangedStepEdits, getChangedSourceEdits, getChangedInterfaceEdits])

  const handleSave = useCallback(() => {
    if (!changeNote.trim()) {
      setErrorMessage('Bitte eine Änderungsnotiz eingeben.')
      return
    }
    if (!hasChanges()) {
      setErrorMessage('Keine Änderungen zum Speichern.')
      return
    }

    setErrorMessage('')
    setSaveStatus('idle')

    startTransition(async () => {
      const result = await saveRedactionalEdits({
        processId,
        changeNote: changeNote.trim(),
        stepEdits: getChangedStepEdits(),
        sourceEdits: getChangedSourceEdits(),
        interfaceEdits: getChangedInterfaceEdits(),
      })

      if (result.success) {
        setSaveStatus('success')
        setChangeNote('')
      } else {
        setSaveStatus('error')
        setErrorMessage(result.error ?? 'Unbekannter Fehler.')
      }
    })
  }, [processId, changeNote, hasChanges, getChangedStepEdits, getChangedSourceEdits, getChangedInterfaceEdits])

  const handleCancel = useCallback(() => {
    // Reset all drafts to original
    const resetSteps: Record<string, StepDraft> = {}
    const resetSources: Record<string, SourceDraft> = {}
    const resetInterfaces: Record<string, InterfaceDraft> = {}

    for (const step of steps) {
      resetSteps[step.id] = {
        description: step.description ?? '',
        expected_output: step.expected_output ?? '',
        show_in_flowchart: step.show_in_flowchart,
      }
      for (const src of step.sources) {
        resetSources[src.id] = {
          label: src.label,
          tool_name: src.tool_name ?? '',
          endpoint: src.endpoint ?? '',
        }
      }
      for (const iface of step.interfaces) {
        resetInterfaces[iface.id] = {
          label: iface.label,
          endpoint: iface.endpoint ?? '',
        }
      }
    }

    setStepDrafts(resetSteps)
    setSourceDrafts(resetSources)
    setInterfaceDrafts(resetInterfaces)
    setChangeNote('')
    setSaveStatus('idle')
    setErrorMessage('')
  }, [steps])

  const sortedSteps = [...steps].sort((a, b) => a.sort_order - b.sort_order)
  const displaySteps = viewMode === 'flowchart'
    ? sortedSteps.filter((s) => s.show_in_flowchart || stepDrafts[s.id]?.show_in_flowchart)
    : sortedSteps

  return (
    <div className="space-y-4">
      {/* Edit mode banner */}
      <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-sm font-semibold text-amber-800">
            Bearbeitungsmodus aktiv
          </span>
          <span className="text-xs text-amber-600">
            — Nur redaktionelle Felder sind bearbeitbar. Strukturelle Änderungen über Holding-Admin.
          </span>
        </div>
      </div>

      {/* Step cards */}
      <div className="space-y-4">
        {displaySteps.map((step) => {
          const draft = stepDrafts[step.id]
          if (!draft) return null

          return (
            <div
              key={step.id}
              className="rounded-lg border-2 border-amber-200 bg-white p-5 space-y-4"
            >
              {/* Header: locked fields */}
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded bg-gray-200 px-2 py-0.5 text-xs font-mono font-medium text-gray-700">
                  {step.process_step_id}
                </span>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-text-primary,#111827)]">
                  <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {step.name}
                </div>
                {step.responsible_roles.length > 0 && (
                  <div className="flex items-center gap-1 ml-auto">
                    <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-xs text-gray-400">
                      {step.responsible_roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Editable: Description */}
              <div>
                <label
                  htmlFor={`desc-${step.id}`}
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-700"
                >
                  Beschreibung
                </label>
                <textarea
                  id={`desc-${step.id}`}
                  value={draft.description}
                  onChange={(e) => updateStepDraft(step.id, 'description', e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-amber-200 bg-amber-50/30 px-3 py-2 text-sm text-[var(--brand-text-primary,#111827)] focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="Beschreibung des Schritts..."
                />
              </div>

              {/* Editable: Expected output */}
              <div>
                <label
                  htmlFor={`output-${step.id}`}
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-700"
                >
                  Erwartetes Ergebnis
                </label>
                <input
                  id={`output-${step.id}`}
                  type="text"
                  value={draft.expected_output}
                  onChange={(e) => updateStepDraft(step.id, 'expected_output', e.target.value)}
                  className="w-full rounded-md border border-amber-200 bg-amber-50/30 px-3 py-2 text-sm text-[var(--brand-text-primary,#111827)] focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="Erwartetes Ergebnis..."
                />
              </div>

              {/* Editable: show_in_flowchart toggle */}
              <div className="flex items-center gap-3">
                <label
                  htmlFor={`flowchart-${step.id}`}
                  className="text-xs font-semibold uppercase tracking-wide text-amber-700"
                >
                  In Flowchart anzeigen
                </label>
                <button
                  id={`flowchart-${step.id}`}
                  type="button"
                  role="switch"
                  aria-checked={draft.show_in_flowchart}
                  onClick={() => updateStepDraft(step.id, 'show_in_flowchart', !draft.show_in_flowchart)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    draft.show_in_flowchart ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                      draft.show_in_flowchart ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Editable: Sources */}
              {step.sources.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Quellen
                  </p>
                  <div className="space-y-2">
                    {step.sources.map((src) => {
                      const srcDraft = sourceDrafts[src.id]
                      if (!srcDraft) return null
                      return (
                        <div key={src.id} className="grid grid-cols-3 gap-2 rounded-md border border-amber-100 bg-amber-50/20 p-2">
                          <input
                            type="text"
                            value={srcDraft.label}
                            onChange={(e) => updateSourceDraft(src.id, 'label', e.target.value)}
                            className="rounded border border-amber-200 px-2 py-1 text-xs focus:border-amber-400 focus:outline-none"
                            placeholder="Label"
                            aria-label={`Quellen-Label für ${src.label}`}
                          />
                          <input
                            type="text"
                            value={srcDraft.tool_name}
                            onChange={(e) => updateSourceDraft(src.id, 'tool_name', e.target.value)}
                            className="rounded border border-amber-200 px-2 py-1 text-xs focus:border-amber-400 focus:outline-none"
                            placeholder="Tool-Name"
                            aria-label={`Tool-Name für ${src.label}`}
                          />
                          <input
                            type="text"
                            value={srcDraft.endpoint}
                            onChange={(e) => updateSourceDraft(src.id, 'endpoint', e.target.value)}
                            className="rounded border border-amber-200 px-2 py-1 text-xs font-mono focus:border-amber-400 focus:outline-none"
                            placeholder="Endpoint"
                            aria-label={`Endpoint für ${src.label}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Editable: Interfaces (label + endpoint only) */}
              {step.interfaces.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Schnittstellen
                  </p>
                  <div className="space-y-2">
                    {step.interfaces.map((iface) => {
                      const ifaceDraft = interfaceDrafts[iface.id]
                      if (!ifaceDraft) return null
                      return (
                        <div key={iface.id} className="grid grid-cols-2 gap-2 rounded-md border border-amber-100 bg-amber-50/20 p-2">
                          <input
                            type="text"
                            value={ifaceDraft.label}
                            onChange={(e) => updateInterfaceDraft(iface.id, 'label', e.target.value)}
                            className="rounded border border-amber-200 px-2 py-1 text-xs focus:border-amber-400 focus:outline-none"
                            placeholder="Label"
                            aria-label={`Schnittstellen-Label für ${iface.label}`}
                          />
                          <input
                            type="text"
                            value={ifaceDraft.endpoint}
                            onChange={(e) => updateInterfaceDraft(iface.id, 'endpoint', e.target.value)}
                            className="rounded border border-amber-200 px-2 py-1 text-xs font-mono focus:border-amber-400 focus:outline-none"
                            placeholder="Endpoint"
                            aria-label={`Endpoint für ${iface.label}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 z-10 rounded-lg border-2 border-amber-300 bg-white p-4 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Änderungsnotiz (erforderlich)..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-[var(--brand-text-primary,#111827)] focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              aria-label="Änderungsnotiz"
            />
          </div>
          <div className="flex items-center gap-3">
            {saveStatus === 'success' && (
              <span className="text-xs font-medium text-green-600">
                Gespeichert
              </span>
            )}
            {errorMessage && (
              <span className="text-xs font-medium text-red-600">
                {errorMessage}
              </span>
            )}
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[var(--brand-text-secondary,#6B7280)] hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !changeNote.trim()}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
