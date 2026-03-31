'use client'

import { useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MappingRow {
  source_field: string
  target_field: string
  transformation: string
}

interface FieldMappingEditorProps {
  mappings: Record<string, unknown>[]
  onChange: (updated: Record<string, unknown>[]) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toMappingRow(raw: Record<string, unknown>): MappingRow {
  return {
    source_field: typeof raw['source_field'] === 'string' ? raw['source_field'] : '',
    target_field: typeof raw['target_field'] === 'string' ? raw['target_field'] : '',
    transformation: typeof raw['transformation'] === 'string' ? raw['transformation'] : '',
  }
}

function fromMappingRow(row: MappingRow): Record<string, unknown> {
  return {
    source_field: row.source_field,
    target_field: row.target_field,
    transformation: row.transformation,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FieldMappingEditor({ mappings, onChange }: FieldMappingEditorProps) {
  const rows = mappings.map(toMappingRow)

  const updateRow = useCallback(
    (index: number, field: keyof MappingRow, value: string) => {
      const updated = [...rows]
      const existing = updated[index] ?? { source_field: '', target_field: '', transformation: '' }
      updated[index] = { ...existing, [field]: value }
      onChange(updated.map(fromMappingRow))
    },
    [rows, onChange],
  )

  const addRow = useCallback(() => {
    onChange([...mappings, fromMappingRow({ source_field: '', target_field: '', transformation: '' })])
  }, [mappings, onChange])

  const removeRow = useCallback(
    (index: number) => {
      const updated = [...rows]
      updated.splice(index, 1)
      onChange(updated.map(fromMappingRow))
    },
    [rows, onChange],
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">Feld-Mapping</p>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Zeile
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Kein Feld-Mapping definiert.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-1.5 pr-2 text-left font-medium text-gray-500">Quellfeld</th>
                <th className="py-1.5 pr-2 text-left font-medium text-gray-500">Zielfeld</th>
                <th className="py-1.5 pr-2 text-left font-medium text-gray-500">Transformation</th>
                <th className="py-1.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      value={row.source_field}
                      onChange={(e) => updateRow(idx, 'source_field', e.target.value)}
                      placeholder="source.field"
                      className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      value={row.target_field}
                      onChange={(e) => updateRow(idx, 'target_field', e.target.value)}
                      placeholder="target.field"
                      className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      value={row.transformation}
                      onChange={(e) => updateRow(idx, 'transformation', e.target.value)}
                      placeholder="z.B. toUpperCase()"
                      className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                    />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                      aria-label="Mapping-Zeile entfernen"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
