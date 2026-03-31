'use client'

import { useState, useTransition } from 'react'
import { savePermissionMatrix, type PermissionMatrixEntry } from './actions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PermissionMatrixClientProps = {
  initialMatrix: PermissionMatrixEntry[]
}

// ---------------------------------------------------------------------------
// Group entries by category
// ---------------------------------------------------------------------------

function groupByCategory(entries: PermissionMatrixEntry[]): Map<string, PermissionMatrixEntry[]> {
  const groups = new Map<string, PermissionMatrixEntry[]>()
  for (const entry of entries) {
    const existing = groups.get(entry.category) ?? []
    existing.push(entry)
    groups.set(entry.category, existing)
  }
  return groups
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function LockIcon() {
  return (
    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case 'Prozesse':
      return (
        <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
      )
    case 'Benutzer':
      return (
        <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      )
    case 'Daten':
      return (
        <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PermissionMatrixClient({ initialMatrix }: PermissionMatrixClientProps) {
  const [matrix, setMatrix] = useState<PermissionMatrixEntry[]>(initialMatrix)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const grouped = groupByCategory(matrix)

  function handleToggle(key: string) {
    setMatrix((prev) =>
      prev.map((entry) =>
        entry.key === key && !entry.platformLocked
          ? { ...entry, enabled: !entry.enabled }
          : entry,
      ),
    )
    setHasChanges(true)
    setFeedback(null)
  }

  function handleSave() {
    const matrixMap: Record<string, boolean> = {}
    for (const entry of matrix) {
      matrixMap[entry.key] = entry.enabled
    }

    startTransition(async () => {
      const result = await savePermissionMatrix(matrixMap)
      if (result.success) {
        setFeedback({ type: 'success', message: 'Berechtigungsmatrix erfolgreich gespeichert.' })
        setHasChanges(false)
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Unbekannter Fehler.' })
      }
    })
  }

  return (
    <div>
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`mb-6 rounded-lg border p-4 ${
            feedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <p className="text-sm">{feedback.message}</p>
        </div>
      )}

      {/* Matrix table grouped by category */}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([category, entries]) => (
          <div key={category} className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
            {/* Category header */}
            <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-6 py-4">
              <CategoryIcon category={category} />
              <h2 className="text-sm font-semibold text-gray-900">{category}</h2>
              <span className="text-xs text-gray-500">({entries.length} Berechtigungen)</span>
            </div>

            {/* Permission rows */}
            <div className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <div
                  key={entry.key}
                  className={`flex items-center justify-between px-6 py-4 ${
                    entry.platformLocked ? 'bg-gray-50/50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${entry.platformLocked ? 'text-gray-400' : 'text-gray-900'}`}>
                        {entry.label}
                      </span>
                      {entry.platformLocked && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          <LockIcon />
                          Plattform
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${entry.platformLocked ? 'text-gray-400' : 'text-gray-500'}`}>
                      {entry.description}
                    </p>
                  </div>

                  {/* Toggle */}
                  <div className="flex-shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={entry.enabled}
                      aria-label={`${entry.label} ${entry.enabled ? 'deaktivieren' : 'aktivieren'}`}
                      disabled={entry.platformLocked}
                      onClick={() => handleToggle(entry.key)}
                      className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                        ${entry.platformLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                        ${entry.enabled ? 'bg-blue-600' : 'bg-gray-300'}
                      `}
                    >
                      <span
                        className={`
                          inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
                          ${entry.enabled ? 'translate-x-6' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="mt-8 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Mit einem Schloss-Symbol gekennzeichnete Berechtigungen sind plattformseitig
          erzwungen und koennen nicht deaktiviert werden.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !hasChanges}
          className={`
            inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-medium text-white
            transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${isPending || !hasChanges
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
            }
          `}
          aria-label="Berechtigungsmatrix speichern"
        >
          {isPending ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Speichern...
            </>
          ) : (
            'Speichern'
          )}
        </button>
      </div>
    </div>
  )
}
