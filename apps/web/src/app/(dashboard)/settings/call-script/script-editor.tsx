'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CallScriptRow } from '@enura/types'
import { saveCallScriptAction, activateScriptVersionAction } from './actions'

type Props = {
  activeScript: CallScriptRow | null
  allScripts: CallScriptRow[]
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '--'
  try {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString))
  } catch {
    return '--'
  }
}

function formatShortDate(dateString: string | null): string {
  if (!dateString) return '--'
  try {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(dateString))
  } catch {
    return '--'
  }
}

export function ScriptEditor({ activeScript, allScripts }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [content, setContent] = useState(activeScript?.content ?? '')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const activeVersion = allScripts.findIndex((s) => s.id === activeScript?.id) + 1
  const totalVersions = allScripts.length

  const handleSave = useCallback(() => {
    setSaveError(null)
    setSaveSuccess(false)

    startTransition(async () => {
      const result = await saveCallScriptAction(content)
      if (result.error) {
        setSaveError(result.error)
      } else {
        setSaveSuccess(true)
        router.refresh()
      }
    })
  }, [content, router])

  const handleActivate = useCallback((scriptId: string) => {
    setSaveError(null)
    setSaveSuccess(false)
    setActivatingId(scriptId)

    startTransition(async () => {
      const result = await activateScriptVersionAction(scriptId)
      if (result.error) {
        setSaveError(result.error)
      } else {
        setSaveSuccess(true)
        router.refresh()
      }
      setActivatingId(null)
    })
  }, [router])

  const hasChanges = content !== (activeScript?.content ?? '')

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-brand-text-primary">
          Gespraechsleitfaden
        </h1>
        {activeScript ? (
          <p className="text-brand-text-secondary mt-1">
            Version {totalVersions - allScripts.findIndex((s) => s.id === activeScript.id)},
            aktualisiert am {formatShortDate(activeScript.updated_at)}
            {totalVersions > 1 && (
              <span className="ml-2 text-xs">
                ({totalVersions} Version{totalVersions !== 1 ? 'en' : ''} gespeichert)
              </span>
            )}
          </p>
        ) : (
          <p className="text-brand-text-secondary mt-1">
            Noch kein Leitfaden vorhanden. Erstellen Sie Ihre erste Version.
          </p>
        )}
      </div>

      {/* Editor */}
      <div className="bg-brand-surface rounded-brand border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-brand-text-primary">Leitfaden bearbeiten</h2>
          {hasChanges && (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
              Ungespeicherte Aenderungen
            </span>
          )}
        </div>

        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            setSaveSuccess(false)
            setSaveError(null)
          }}
          placeholder="Geben Sie hier den Gespraechsleitfaden ein...&#10;&#10;Beispiel:&#10;1. Begruessung: Guten Tag, mein Name ist [Name] von [Firma]...&#10;2. Bedarfsermittlung: Haben Sie sich schon einmal mit dem Thema Photovoltaik beschaeftigt?&#10;3. Terminvereinbarung: Wann passt es Ihnen am besten fuer ein unverbindliches Beratungsgespraech?"
          rows={16}
          className="w-full rounded-brand border border-gray-300 bg-brand-background px-4 py-3 font-mono text-sm text-brand-text-primary placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 resize-y"
          style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
          aria-label="Gespraechsleitfaden bearbeiten"
        />

        {/* Feedback messages */}
        {saveError && (
          <div
            className="mt-4 flex items-center gap-2 rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span>{saveError}</span>
          </div>
        )}
        {saveSuccess && (
          <div
            className="mt-4 flex items-center gap-2 rounded-brand border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
            role="alert"
          >
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span>Erfolgreich gespeichert.</span>
          </div>
        )}

        {/* Save button */}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !hasChanges}
            className="rounded-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {isPending && activatingId === null ? 'Wird gespeichert...' : 'Neue Version speichern'}
          </button>
          {hasChanges && (
            <button
              type="button"
              onClick={() => {
                setContent(activeScript?.content ?? '')
                setSaveError(null)
                setSaveSuccess(false)
              }}
              disabled={isPending}
              className="rounded-brand border border-gray-300 bg-brand-background px-4 py-2 text-sm font-medium text-brand-text-primary hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Verwerfen
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      {content.length > 0 && (
        <div className="bg-brand-surface rounded-brand border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">Vorschau</h2>
          <div className="rounded-brand border border-gray-200 bg-brand-background p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm text-brand-text-primary leading-relaxed">
              {content}
            </pre>
          </div>
        </div>
      )}

      {/* Version History */}
      {allScripts.length > 0 && (
        <div className="bg-brand-surface rounded-brand border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">Versionshistorie</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                    Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                    Datum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-brand-text-secondary">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allScripts.map((script, index) => {
                  const versionNum = allScripts.length - index
                  const isActive = script.is_active

                  return (
                    <tr
                      key={script.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-brand-text-primary">
                        v{versionNum}
                      </td>
                      <td className="px-4 py-3 text-sm text-brand-text-secondary">
                        {script.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-brand-text-secondary">
                        {formatDate(script.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {isActive ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            Aktiv
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            Inaktiv
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setContent(script.content)
                              setSaveSuccess(false)
                              setSaveError(null)
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            disabled={isPending}
                            className="rounded-brand px-2.5 py-1.5 text-xs font-medium text-brand-text-secondary hover:bg-gray-100 transition-colors disabled:opacity-50"
                            aria-label={`Version ${versionNum} in Editor laden`}
                          >
                            Laden
                          </button>
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleActivate(script.id)}
                              disabled={isPending}
                              className="rounded-brand px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                              style={{ color: 'var(--brand-primary)' }}
                              aria-label={`Version ${versionNum} aktivieren`}
                            >
                              {activatingId === script.id ? 'Wird aktiviert...' : 'Aktivieren'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
