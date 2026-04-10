'use client'

import { useState, useCallback, useRef } from 'react'
import { uploadTemplateAction, type UploadTemplateResult } from './actions'

const CATEGORY_LABELS: Record<string, string> = {
  verkauf: 'Verkauf',
  planung: 'Planung',
  abwicklung: 'Abwicklung',
  betrieb: 'Betrieb',
  sonstige: 'Sonstige',
}

const MAX_FILE_SIZE = 500 * 1024 // 500KB

interface ParsedTemplate {
  name: string
  description?: string | null
  category: string
  version?: string
  steps: Array<{ name: string; responsible_roles?: string[]; sort_order?: number }>
}

export function TemplateUploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedTemplate | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadTemplateResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setFile(null)
    setParsed(null)
    setClientError(null)
    setResult(null)
  }, [])

  const processFile = useCallback((f: File) => {
    setResult(null)
    setClientError(null)

    if (!f.name.endsWith('.json')) {
      setClientError('Nur .json-Dateien sind erlaubt.')
      setFile(null)
      setParsed(null)
      return
    }

    if (f.size > MAX_FILE_SIZE) {
      setClientError(`Die Datei ist zu gross (${(f.size / 1024).toFixed(0)} KB). Maximal 500 KB erlaubt.`)
      setFile(null)
      setParsed(null)
      return
    }

    setFile(f)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string) as ParsedTemplate
        if (!json.name || !json.category || !Array.isArray(json.steps)) {
          setClientError('Die JSON-Datei muss "name", "category" und "steps" enthalten.')
          setParsed(null)
          return
        }
        setParsed(json)
        setClientError(null)
      } catch {
        setClientError('Die Datei enthält kein gültiges JSON.')
        setParsed(null)
      }
    }
    reader.readAsText(f)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) processFile(dropped)
    },
    [processFile],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0]
      if (selected) processFile(selected)
    },
    [processFile],
  )

  const handleUpload = useCallback(async () => {
    if (!parsed) return
    setUploading(true)
    setResult(null)

    try {
      const res = await uploadTemplateAction(parsed)
      setResult(res)
      if (res.success) {
        setFile(null)
        setParsed(null)
      }
    } catch {
      setResult({ success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' })
    } finally {
      setUploading(false)
    }
  }, [parsed])

  return (
    <div className="space-y-6">
      {/* Download example link */}
      <div className="flex items-center gap-2 text-sm">
        <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <a
          href="/beispiel-prozessvorlage.json"
          download="beispiel-prozessvorlage.json"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Beispielvorlage herunterladen
        </a>
        <span className="text-gray-400">(.json)</span>
      </div>

      {/* Drop zone */}
      <div
        className={`
          relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10
          transition-colors duration-150 cursor-pointer
          ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}
        `}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
        aria-label="JSON-Datei auswählen oder ablegen"
      >
        <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm font-medium text-gray-700">
          JSON-Datei hier ablegen oder <span className="text-blue-600">durchsuchen</span>
        </p>
        <p className="mt-1 text-xs text-gray-500">Nur .json-Dateien (max. 500 KB)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="JSON-Datei auswählen"
        />
      </div>

      {/* Client error */}
      {clientError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{clientError}</p>
        </div>
      )}

      {/* Preview */}
      {parsed && !result?.success && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Vorschau</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <span className="text-gray-500">Name:</span>{' '}
              <span className="font-medium text-gray-900">{parsed.name}</span>
            </div>
            <div>
              <span className="text-gray-500">Kategorie:</span>{' '}
              <span className="font-medium text-gray-900">
                {CATEGORY_LABELS[parsed.category] ?? parsed.category}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Version:</span>{' '}
              <span className="font-medium text-gray-900">{parsed.version ?? '1.0.0'}</span>
            </div>
            <div>
              <span className="text-gray-500">Schritte:</span>{' '}
              <span className="font-medium text-gray-900">{parsed.steps.length}</span>
            </div>
          </div>
          {parsed.description && (
            <p className="text-sm text-gray-600 mb-4">{parsed.description}</p>
          )}

          {/* Step list preview */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Schritte</p>
            <ol className="space-y-1.5">
              {parsed.steps.map((step, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    {i + 1}
                  </span>
                  <span className="text-gray-800">{step.name}</span>
                  {step.responsible_roles && step.responsible_roles.length > 0 && (
                    <span className="text-xs text-gray-400">
                      ({step.responsible_roles.join(', ')})
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Upload button */}
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Wird hochgeladen...' : 'Vorlage hochladen'}
            </button>
            <button
              type="button"
              onClick={resetState}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Server error */}
      {result && !result.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800 mb-1">{result.error}</p>
          {result.fieldErrors && (
            <ul className="mt-2 space-y-1">
              {Object.entries(result.fieldErrors).map(([path, msg]) => (
                <li key={path} className="text-xs text-red-600">
                  <span className="font-mono">{path}</span>: {msg}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Success */}
      {result?.success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-semibold text-green-800">
              Vorlage &quot;{result.templateName}&quot; erfolgreich erstellt
            </p>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={resetState}
              className="rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-50 transition-colors"
            >
              Weitere Vorlage hochladen
            </button>
            <a
              href="/admin/processes/new"
              className="text-sm text-green-700 underline hover:text-green-900"
            >
              Neuen Prozess erstellen
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
