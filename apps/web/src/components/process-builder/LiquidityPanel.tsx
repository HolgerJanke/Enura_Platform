'use client'

import { useState, useCallback } from 'react'
import type {
  ProcessStepLiquidityRow,
  ProcessStepRow,
} from '@enura/types'
import { updateLiquidityAction } from '@/app/(holding)/admin/processes/[id]/actions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LiquidityPanelProps {
  processId: string
  holdingId: string
  companyId: string | null
  stepId: string
  data: ProcessStepLiquidityRow | null
  allSteps: ProcessStepRow[]
  currentMarkerType: ProcessStepRow['liquidity_marker']
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiquidityPanel({
  processId,
  holdingId,
  companyId,
  stepId,
  data,
  allSteps,
  currentMarkerType,
}: LiquidityPanelProps) {
  const [markerType, setMarkerType] = useState<'trigger' | 'event'>(data?.marker_type ?? 'trigger')
  const [direction, setDirection] = useState<'income' | 'expense'>(data?.direction ?? 'income')
  const [planCurrency, setPlanCurrency] = useState(data?.plan_currency ?? 'CHF')
  const [planAmount, setPlanAmount] = useState(data?.plan_amount ?? '')
  const [amountType, setAmountType] = useState<'fixed' | 'percentage'>(data?.amount_type ?? 'fixed')
  const [planDelayDays, setPlanDelayDays] = useState<number | null>(data?.plan_delay_days ?? 0)
  const [triggerStepId, setTriggerStepId] = useState(data?.trigger_step_id ?? '')
  const [sourceTool, setSourceTool] = useState(data?.source_tool ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = useCallback(async () => {
    setIsSaving(true)
    setSaveError(null)

    const result = await updateLiquidityAction({
      processId,
      stepId,
      holdingId,
      companyId,
      markerType,
      direction,
      planCurrency,
      planAmount: planAmount || null,
      amountType,
      planDelayDays,
      triggerStepId: triggerStepId || null,
      sourceTool: sourceTool || null,
    })

    if (!result.success) {
      setSaveError(result.error ?? 'Unbekannter Fehler')
    }
    setIsSaving(false)
  }, [
    processId,
    stepId,
    holdingId,
    companyId,
    markerType,
    direction,
    planCurrency,
    planAmount,
    amountType,
    planDelayDays,
    triggerStepId,
    sourceTool,
  ])

  // If the step has no liquidity_marker set, show a hint
  if (!currentMarkerType) {
    return (
      <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">
          Um Liquiditaetsdaten zu erfassen, setzen Sie zuerst den Liquiditaetsmarker
          dieses Schritts auf &quot;Trigger&quot; oder &quot;Event&quot;.
        </p>
      </div>
    )
  }

  // When marker_type is 'event', show the linked trigger step
  const isEvent = markerType === 'event'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Liquiditaet</h4>
        {saveError && <span className="text-xs text-red-600">{saveError}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Marker type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Marker-Typ</label>
          <select
            value={markerType}
            onChange={(e) => setMarkerType(e.target.value as 'trigger' | 'event')}
            onBlur={save}
            className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            <option value="trigger">Trigger</option>
            <option value="event">Event</option>
          </select>
        </div>

        {/* Direction */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Richtung</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'income' | 'expense')}
            onBlur={save}
            className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            <option value="income">Einnahme</option>
            <option value="expense">Ausgabe</option>
          </select>
        </div>

        {/* Currency */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Waehrung</label>
          <select
            value={planCurrency}
            onChange={(e) => setPlanCurrency(e.target.value)}
            onBlur={save}
            className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            <option value="CHF">CHF</option>
            <option value="EUR">EUR</option>
          </select>
        </div>

        {/* Amount (only for trigger) */}
        {!isEvent && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Planbetrag</label>
              <input
                type="text"
                value={planAmount}
                onChange={(e) => setPlanAmount(e.target.value)}
                onBlur={save}
                placeholder="0.00"
                className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Betragstyp</label>
              <select
                value={amountType}
                onChange={(e) => setAmountType(e.target.value as 'fixed' | 'percentage')}
                onBlur={save}
                className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
              >
                <option value="fixed">Fest</option>
                <option value="percentage">Prozent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Verzoegerung (Tage)</label>
              <input
                type="number"
                value={planDelayDays ?? ''}
                onChange={(e) =>
                  setPlanDelayDays(e.target.value ? parseInt(e.target.value, 10) : null)
                }
                onBlur={save}
                min={0}
                className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
              />
            </div>
          </>
        )}

        {/* Linked trigger step (only for event) */}
        {isEvent && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Verknuepfter Trigger-Schritt</label>
            <select
              value={triggerStepId}
              onChange={(e) => setTriggerStepId(e.target.value)}
              onBlur={save}
              className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
            >
              <option value="">Keiner</option>
              {allSteps
                .filter((s) => s.id !== stepId && s.liquidity_marker === 'trigger')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.process_step_id} - {s.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Source tool */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Quell-Tool</label>
          <input
            type="text"
            value={sourceTool}
            onChange={(e) => setSourceTool(e.target.value)}
            onBlur={save}
            placeholder="z.B. Bexio"
            className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Save button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {isSaving ? 'Speichern...' : 'Liquiditaet speichern'}
        </button>
      </div>
    </div>
  )
}
