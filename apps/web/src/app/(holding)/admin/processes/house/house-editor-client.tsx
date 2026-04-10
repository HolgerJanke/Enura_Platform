'use client'

import { useState, useTransition } from 'react'
import { updateProcessTypeAction, reorderProcessHouseAction } from './actions'

interface Process {
  id: string
  name: string
  menu_label: string
  process_type: string | null
  house_sort_order: number
  status: string
}

interface Props {
  companyId: string
  processes: Process[]
}

const TYPES = [
  { key: 'M', label: 'Management / Strategisch', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { key: 'P', label: 'Kernprozesse', color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'S', label: 'Stützprozesse', color: 'bg-sky-100 text-sky-700 border-sky-200' },
] as const

export function ProcessHouseEditorClient({ companyId, processes }: Props) {
  const [items, setItems] = useState(processes)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  function handleTypeChange(processId: string, newType: string) {
    const type = newType === '' ? null : (newType as 'M' | 'P' | 'S')
    setItems((prev) => prev.map((p) => p.id === processId ? { ...p, process_type: type } : p))

    startTransition(async () => {
      const result = await updateProcessTypeAction(processId, type)
      if (result.success) {
        setFeedback('Prozesstyp aktualisiert.')
        setTimeout(() => setFeedback(null), 2000)
      }
    })
  }

  function handleMoveUp(processId: string, processType: string) {
    setItems((prev) => {
      const group = prev.filter((p) => p.process_type === processType)
      const idx = group.findIndex((p) => p.id === processId)
      if (idx <= 0) return prev
      // Swap sort orders
      const updated = prev.map((p) => {
        if (p.id === group[idx]!.id) return { ...p, house_sort_order: group[idx - 1]!.house_sort_order }
        if (p.id === group[idx - 1]!.id) return { ...p, house_sort_order: group[idx]!.house_sort_order }
        return p
      })
      return updated
    })

    // Save reorder
    const group = items.filter((p) => p.process_type === processType)
    const idx = group.findIndex((p) => p.id === processId)
    if (idx <= 0) return
    const order = group.map((p, i) => ({ processId: p.id, sortOrder: i }))
    // Swap
    const temp = order[idx]!.sortOrder
    order[idx]!.sortOrder = order[idx - 1]!.sortOrder
    order[idx - 1]!.sortOrder = temp

    startTransition(async () => {
      await reorderProcessHouseAction(companyId, processType as 'M' | 'P' | 'S', order)
    })
  }

  function handleMoveDown(processId: string, processType: string) {
    const group = items.filter((p) => p.process_type === processType)
    const idx = group.findIndex((p) => p.id === processId)
    if (idx >= group.length - 1) return

    setItems((prev) => {
      return prev.map((p) => {
        if (p.id === group[idx]!.id) return { ...p, house_sort_order: group[idx + 1]!.house_sort_order }
        if (p.id === group[idx + 1]!.id) return { ...p, house_sort_order: group[idx]!.house_sort_order }
        return p
      })
    })

    const order = group.map((p, i) => ({ processId: p.id, sortOrder: i }))
    const temp = order[idx]!.sortOrder
    order[idx]!.sortOrder = order[idx + 1]!.sortOrder
    order[idx + 1]!.sortOrder = temp

    startTransition(async () => {
      await reorderProcessHouseAction(companyId, processType as 'M' | 'P' | 'S', order)
    })
  }

  const unassigned = items.filter((p) => !p.process_type)

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
                {group.map((proc, i) => (
                  <div key={proc.id} className="flex items-center gap-3 rounded-lg bg-white/80 px-4 py-2.5">
                    <span className="text-sm font-bold text-gray-600 w-8">{key}{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-gray-900">{proc.menu_label}</span>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${proc.status === 'deployed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {proc.status}
                    </span>
                    <div className="flex gap-1">
                      <button type="button" disabled={i === 0 || isPending} onClick={() => handleMoveUp(proc.id, key)} className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-200 disabled:opacity-30" aria-label="Nach oben">↑</button>
                      <button type="button" disabled={i === group.length - 1 || isPending} onClick={() => handleMoveDown(proc.id, key)} className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-200 disabled:opacity-30" aria-label="Nach unten">↓</button>
                    </div>
                  </div>
                ))}
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
