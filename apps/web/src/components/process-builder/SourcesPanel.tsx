'use client'

import { useState, useCallback } from 'react'
import type { ProcessStepSourceRow } from '@enura/types'
import {
  addSourceAction,
  updateSourceAction,
  deleteSourceAction,
} from '@/app/(holding)/admin/processes/[id]/actions'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_TYPES = [
  { value: 'rest_api', label: 'REST API' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'file', label: 'Datei' },
  { value: 'supabase', label: 'Supabase' },
  { value: 'google', label: 'Google' },
  { value: 'manual', label: 'Manuell' },
  { value: 'other', label: 'Sonstige' },
] as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SourcesPanelProps {
  processId: string
  holdingId: string
  companyId: string | null
  stepId: string
  sources: ProcessStepSourceRow[]
}

// ---------------------------------------------------------------------------
// Inline source editor
// ---------------------------------------------------------------------------

interface SourceRowProps {
  source: ProcessStepSourceRow
  processId: string
  onDeleted: (sourceId: string) => void
}

function SourceRow({ source, processId, onDeleted }: SourceRowProps) {
  const [label, setLabel] = useState(source.label)
  const [sourceType, setSourceType] = useState(source.source_type)
  const [toolName, setToolName] = useState(source.tool_name ?? '')
  const [endpoint, setEndpoint] = useState(source.endpoint ?? '')
  const [description, setDescription] = useState(source.description ?? '')
  const [isDeleting, setIsDeleting] = useState(false)

  const save = useCallback(async () => {
    await updateSourceAction({
      sourceId: source.id,
      processId,
      label,
      sourceType,
      toolName: toolName || null,
      endpoint: endpoint || null,
      description: description || null,
    })
  }, [source.id, processId, label, sourceType, toolName, endpoint, description])

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    const result = await deleteSourceAction(source.id, processId)
    if (result.success) {
      onDeleted(source.id)
    }
    setIsDeleting(false)
  }, [source.id, processId, onDeleted])

  return (
    <div className={`rounded-md border border-gray-200 p-3 space-y-3 ${isDeleting ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Bezeichnung</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={save}
              className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
            />
          </div>

          {/* Source type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Quellentyp</label>
            <select
              value={sourceType}
              onChange={(e) => {
                setSourceType(e.target.value as typeof sourceType)
              }}
              onBlur={save}
              className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tool name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tool-Name</label>
            <input
              type="text"
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              onBlur={save}
              placeholder="z.B. Reonic"
              className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
            />
          </div>

          {/* Endpoint */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Endpoint</label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              onBlur={save}
              placeholder="https://api.example.com/..."
              className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Beschreibung</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={save}
              className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="mt-5 p-1 text-gray-400 hover:text-red-600 transition-colors"
          aria-label="Quelle entfernen"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function SourcesPanel({ processId, holdingId, companyId, stepId, sources: initialSources }: SourcesPanelProps) {
  const [sources, setSources] = useState<ProcessStepSourceRow[]>(initialSources)
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = useCallback(async () => {
    setIsAdding(true)
    const result = await addSourceAction({
      holdingId,
      companyId,
      processId,
      stepId,
      label: 'Neue Quelle',
      sourceType: 'rest_api',
    })

    if (result.success && result.data) {
      setSources((prev) => [...prev, result.data as unknown as ProcessStepSourceRow])
    }
    setIsAdding(false)
  }, [holdingId, companyId, processId, stepId])

  const handleDeleted = useCallback((sourceId: string) => {
    setSources((prev) => prev.filter((s) => s.id !== sourceId))
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Informationsquellen</h4>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isAdding}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Quelle hinzufuegen
        </button>
      </div>

      {sources.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Keine Quellen definiert.</p>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              processId={processId}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
