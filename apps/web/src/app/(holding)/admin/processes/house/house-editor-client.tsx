'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import {
  updateProcessTypeAction,
  reorderProcessHouseAction,
  addPhaseAction,
  updatePhaseAction,
  deletePhaseAction,
  reorderPhasesAction,
} from './actions'

interface Process {
  id: string
  name: string
  menu_label: string
  process_type: string | null
  house_sort_order: number
  status: string
}

interface Phase {
  id: string
  process_id: string
  name: string
  sort_order: number
}

interface Props {
  companyId: string
  holdingId: string
  processes: Process[]
  phases: Phase[]
}

const TYPES = [
  { key: 'M', label: 'Management / Strategisch', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { key: 'P', label: 'Kernprozesse', color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'S', label: 'Stützprozesse', color: 'bg-sky-100 text-sky-700 border-sky-200' },
] as const

export function ProcessHouseEditorClient({ companyId, holdingId, processes, phases: initialPhases }: Props) {
  const [items, setItems] = useState(processes)
  const [phases, setPhases] = useState(initialPhases)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [expandedProcess, setExpandedProcess] = useState<string | null>(null)
  const [addingPhaseFor, setAddingPhaseFor] = useState<string | null>(null)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [editingPhase, setEditingPhase] = useState<string | null>(null)
  const [editPhaseName, setEditPhaseName] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingPhaseFor && addInputRef.current) {
      addInputRef.current.focus()
    }
  }, [addingPhaseFor])

  useEffect(() => {
    if (editingPhase && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingPhase])

  function showFeedback(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 2000)
  }

  function handleTypeChange(processId: string, newType: string) {
    const type = newType === '' ? null : (newType as 'M' | 'P' | 'S')
    setItems((prev) => prev.map((p) => p.id === processId ? { ...p, process_type: type } : p))

    startTransition(async () => {
      const result = await updateProcessTypeAction(processId, type)
      if (result.success) showFeedback('Prozesstyp aktualisiert.')
    })
  }

  function handleMove(processId: string, processType: string, direction: 'up' | 'down') {
    const group = items
      .filter((p) => p.process_type === processType)
      .sort((a, b) => a.house_sort_order - b.house_sort_order)
    const idx = group.findIndex((p) => p.id === processId)

    if (direction === 'up' && idx <= 0) return
    if (direction === 'down' && idx >= group.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const currentItem = group[idx]!
    const swapItem = group[swapIdx]!

    setItems((prev) => prev.map((p) => {
      if (p.id === currentItem.id) return { ...p, house_sort_order: swapItem.house_sort_order }
      if (p.id === swapItem.id) return { ...p, house_sort_order: currentItem.house_sort_order }
      return p
    }))

    const newOrder = group.map((p, i) => {
      if (i === idx) return { processId: swapItem.id, sortOrder: i }
      if (i === swapIdx) return { processId: currentItem.id, sortOrder: i }
      return { processId: p.id, sortOrder: i }
    })

    startTransition(async () => {
      await reorderProcessHouseAction(companyId, processType as 'M' | 'P' | 'S', newOrder)
      showFeedback('Reihenfolge aktualisiert.')
    })
  }

  // --- Phase handlers ---

  function handleAddPhase(processId: string) {
    const trimmed = newPhaseName.trim()
    if (!trimmed) return

    startTransition(async () => {
      const result = await addPhaseAction(processId, holdingId, companyId, trimmed)
      if (result.success && result.phaseId) {
        const existingPhases = phases.filter((p) => p.process_id === processId)
        const nextOrder = existingPhases.length > 0
          ? Math.max(...existingPhases.map((p) => p.sort_order)) + 1
          : 0
        setPhases((prev) => [...prev, { id: result.phaseId!, process_id: processId, name: trimmed, sort_order: nextOrder }])
        setNewPhaseName('')
        setAddingPhaseFor(null)
        showFeedback('Phase hinzugefügt.')
      } else {
        showFeedback(result.error ?? 'Fehler beim Erstellen der Phase.')
      }
    })
  }

  function handleUpdatePhase(phaseId: string) {
    const trimmed = editPhaseName.trim()
    if (!trimmed) return

    setPhases((prev) => prev.map((p) => p.id === phaseId ? { ...p, name: trimmed } : p))
    setEditingPhase(null)

    startTransition(async () => {
      const result = await updatePhaseAction(phaseId, trimmed)
      if (result.success) showFeedback('Phase aktualisiert.')
      else showFeedback(result.error ?? 'Fehler beim Aktualisieren.')
    })
  }

  function handleDeletePhase(phaseId: string) {
    setPhases((prev) => prev.filter((p) => p.id !== phaseId))

    startTransition(async () => {
      const result = await deletePhaseAction(phaseId)
      if (result.success) showFeedback('Phase gelöscht.')
      else showFeedback(result.error ?? 'Fehler beim Löschen.')
    })
  }

  function handleMovePhase(phaseId: string, processId: string, direction: 'up' | 'down') {
    const group = phases
      .filter((p) => p.process_id === processId)
      .sort((a, b) => a.sort_order - b.sort_order)
    const idx = group.findIndex((p) => p.id === phaseId)

    if (direction === 'up' && idx <= 0) return
    if (direction === 'down' && idx >= group.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const current = group[idx]!
    const swap = group[swapIdx]!

    setPhases((prev) => prev.map((p) => {
      if (p.id === current.id) return { ...p, sort_order: swap.sort_order }
      if (p.id === swap.id) return { ...p, sort_order: current.sort_order }
      return p
    }))

    const newOrder = group.map((p, i) => {
      if (i === idx) return { phaseId: swap.id, sortOrder: i }
      if (i === swapIdx) return { phaseId: current.id, sortOrder: i }
      return { phaseId: p.id, sortOrder: i }
    })

    startTransition(async () => {
      await reorderPhasesAction(processId, newOrder)
      showFeedback('Phasenreihenfolge aktualisiert.')
    })
  }

  function getPhasesForProcess(processId: string) {
    return phases
      .filter((p) => p.process_id === processId)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  const unassigned = items.filter((p) => !p.process_type)

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-500">Dieses Unternehmen hat noch keine Prozesse.</p>
        <p className="text-xs text-gray-400 mt-1">Erstellen Sie Prozesse unter &quot;Prozesse&quot; und weisen Sie ihnen dann hier einen Typ zu.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {feedback && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{feedback}</div>
      )}

      {/* Type sections */}
      {TYPES.map(({ key, label, color }) => {
        const group = items
          .filter((p) => p.process_type === key)
          .sort((a, b) => a.house_sort_order - b.house_sort_order)

        return (
          <div key={key} className={`rounded-lg border p-5 ${color}`}>
            <h3 className="text-sm font-bold mb-3">{key} — {label}</h3>
            {group.length === 0 ? (
              <p className="text-xs opacity-60">Keine Prozesse zugewiesen.</p>
            ) : (
              <div className="space-y-2">
                {group.map((proc, i) => {
                  const processPhases = getPhasesForProcess(proc.id)
                  const isExpanded = expandedProcess === proc.id

                  return (
                    <div key={proc.id}>
                      <div className="flex items-center gap-3 rounded-lg bg-white/80 px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setExpandedProcess(isExpanded ? null : proc.id)}
                          className="text-gray-400 hover:text-gray-600 text-xs w-4 shrink-0"
                          aria-label={isExpanded ? 'Phasen einklappen' : 'Phasen ausklappen'}
                        >
                          {isExpanded ? '▾' : '▸'}
                        </button>
                        <span className="text-sm font-bold text-gray-600 w-8">{key}{i + 1}</span>
                        <span className="flex-1 text-sm font-medium text-gray-900">{proc.menu_label}</span>
                        <span className="text-[11px] text-gray-400">{processPhases.length} {processPhases.length === 1 ? 'Phase' : 'Phasen'}</span>
                        <span className={`text-xs rounded-full px-2 py-0.5 ${proc.status === 'deployed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {proc.status}
                        </span>
                        <div className="flex gap-1">
                          <button type="button" disabled={i === 0 || isPending} onClick={() => handleMove(proc.id, key, 'up')} className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-200 disabled:opacity-30" aria-label="Nach oben">↑</button>
                          <button type="button" disabled={i === group.length - 1 || isPending} onClick={() => handleMove(proc.id, key, 'down')} className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-200 disabled:opacity-30" aria-label="Nach unten">↓</button>
                        </div>
                      </div>

                      {/* Expanded phases section */}
                      {isExpanded && (
                        <div className="ml-12 mt-1 mb-2 space-y-1">
                          {processPhases.length === 0 && !addingPhaseFor && (
                            <p className="text-xs text-gray-400 py-1">Noch keine Phasen definiert.</p>
                          )}
                          {processPhases.map((phase, pi) => (
                            <div key={phase.id} className="flex items-center gap-2 rounded bg-white/60 px-3 py-1.5 text-sm">
                              {editingPhase === phase.id ? (
                                <>
                                  <span className="text-xs font-mono text-gray-400 w-10">{key}{i + 1}.{pi + 1}</span>
                                  <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editPhaseName}
                                    onChange={(e) => setEditPhaseName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleUpdatePhase(phase.id)
                                      if (e.key === 'Escape') setEditingPhase(null)
                                    }}
                                    className="flex-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-sm"
                                  />
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handleUpdatePhase(phase.id)}
                                    className="text-xs text-green-700 hover:text-green-900 font-medium"
                                  >
                                    Speichern
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingPhase(null)}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    Abbrechen
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="text-xs font-mono text-gray-400 w-10">{key}{i + 1}.{pi + 1}</span>
                                  <span className="flex-1 text-gray-800">{phase.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => { setEditingPhase(phase.id); setEditPhaseName(phase.name) }}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                    aria-label="Phase bearbeiten"
                                  >
                                    ✎
                                  </button>
                                  <div className="flex gap-0.5">
                                    <button type="button" disabled={pi === 0 || isPending} onClick={() => handleMovePhase(phase.id, proc.id, 'up')} className="rounded px-1 py-0.5 text-xs text-gray-400 hover:bg-gray-200 disabled:opacity-30" aria-label="Phase nach oben">↑</button>
                                    <button type="button" disabled={pi === processPhases.length - 1 || isPending} onClick={() => handleMovePhase(phase.id, proc.id, 'down')} className="rounded px-1 py-0.5 text-xs text-gray-400 hover:bg-gray-200 disabled:opacity-30" aria-label="Phase nach unten">↓</button>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handleDeletePhase(phase.id)}
                                    className="text-xs text-red-400 hover:text-red-600"
                                    aria-label="Phase löschen"
                                  >
                                    ✕
                                  </button>
                                </>
                              )}
                            </div>
                          ))}

                          {/* Add phase form */}
                          {addingPhaseFor === proc.id ? (
                            <div className="flex items-center gap-2 rounded bg-white/60 px-3 py-1.5">
                              <input
                                ref={addInputRef}
                                type="text"
                                placeholder="Phasenname..."
                                value={newPhaseName}
                                onChange={(e) => setNewPhaseName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddPhase(proc.id)
                                  if (e.key === 'Escape') { setAddingPhaseFor(null); setNewPhaseName('') }
                                }}
                                className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                              />
                              <button
                                type="button"
                                disabled={isPending || !newPhaseName.trim()}
                                onClick={() => handleAddPhase(proc.id)}
                                className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                Hinzufügen
                              </button>
                              <button
                                type="button"
                                onClick={() => { setAddingPhaseFor(null); setNewPhaseName('') }}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                Abbrechen
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setAddingPhaseFor(proc.id); setNewPhaseName('') }}
                              className="flex items-center gap-1 rounded px-3 py-1.5 text-xs text-gray-500 hover:bg-white/60 hover:text-gray-700 transition-colors"
                            >
                              <span className="text-sm">+</span> Phase hinzufügen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Unassigned processes */}
      {unassigned.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Nicht zugewiesen ({unassigned.length})</h3>
          <div className="space-y-2">
            {unassigned.map((proc) => (
              <div key={proc.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-2.5">
                <span className="flex-1 text-sm font-medium text-gray-900">{proc.menu_label}</span>
                <select
                  value=""
                  onChange={(e) => handleTypeChange(proc.id, e.target.value)}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="">Typ zuweisen...</option>
                  <option value="M">M — Management</option>
                  <option value="P">P — Kernprozess</option>
                  <option value="S">S — Stützprozess</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
