'use client'

import { useState, useTransition } from 'react'
import { createProcessKpi, deleteProcessKpi } from './actions'

interface KpiRow {
  id: string
  name: string
  description: string | null
  unit: string
  target_value: number | null
  warning_threshold: number | null
  critical_threshold: number | null
  visible_roles: string[]
  is_active: boolean
}

interface Props {
  processId: string
  initialKpis: KpiRow[]
}

export function KpiEditorClient({ processId, initialKpis }: Props) {
  const [kpis, setKpis] = useState(initialKpis)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [target, setTarget] = useState('')
  const [warning, setWarning] = useState('')
  const [critical, setCritical] = useState('')
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function handleCreate() {
    if (!name.trim()) return
    startTransition(async () => {
      setFeedback(null)
      const result = await createProcessKpi({
        processId,
        name,
        unit: unit || '',
        targetValue: target ? Number(target) : null,
        warningThreshold: warning ? Number(warning) : null,
        criticalThreshold: critical ? Number(critical) : null,
        visibleRoles: [],
      })
      if (result.success) {
        setFeedback({ type: 'success', message: `KPI "${name}" erstellt.` })
        setName('')
        setUnit('')
        setTarget('')
        setWarning('')
        setCritical('')
        setShowForm(false)
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Fehler.' })
      }
    })
  }

  function handleDelete(kpiId: string, kpiName: string) {
    if (!confirm(`KPI "${kpiName}" löschen?`)) return
    startTransition(async () => {
      const result = await deleteProcessKpi(kpiId)
      if (result.success) {
        setKpis((prev) => prev.filter((k) => k.id !== kpiId))
        setFeedback({ type: 'success', message: `KPI "${kpiName}" gelöscht.` })
      }
    })
  }

  return (
    <div>
      {feedback && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.message}
        </div>
      )}

      {/* KPI table */}
      {kpis.length === 0 && !showForm ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center mb-6">
          <p className="text-sm text-gray-500">Noch keine KPIs definiert.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Einheit</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Ziel</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Warnung</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Kritisch</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {kpis.map((kpi) => (
                <tr key={kpi.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{kpi.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{kpi.unit || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right font-mono">{kpi.target_value ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-amber-600 text-right font-mono">{kpi.warning_threshold ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-red-600 text-right font-mono">{kpi.critical_threshold ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => handleDelete(kpi.id, kpi.name)} disabled={isPending} className="text-xs text-red-600 hover:text-red-800">
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add KPI form */}
      {showForm ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Neuen KPI erstellen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Durchlaufzeit" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Einheit</label>
              <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="z.B. Tage, %, CHF" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Zielwert</label>
              <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="z.B. 30" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Warnschwelle</label>
              <input type="number" value={warning} onChange={(e) => setWarning(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Kritische Schwelle</label>
              <input type="number" value={critical} onChange={(e) => setCritical(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={isPending || !name.trim()} onClick={handleCreate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              Erstellen
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          + KPI hinzufügen
        </button>
      )}
    </div>
  )
}
