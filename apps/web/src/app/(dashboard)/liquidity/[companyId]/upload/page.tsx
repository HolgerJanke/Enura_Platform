'use client'

import { useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { uploadBankFile } from '../actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FileFormat = 'camt053' | 'mt940' | 'csv'

interface ParseResult {
  transactionCount: number
  periodFrom: string | null
  periodTo: string | null
}

// ---------------------------------------------------------------------------
// Upload Page
// ---------------------------------------------------------------------------

export default function BankUploadPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [file, setFile] = useState<File | null>(null)
  const [fileFormat, setFileFormat] = useState<FileFormat>('camt053')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    matched: number
    unmatched: number
    total: number
  } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) {
      setFile(dropped)
      setError(null)
      setResult(null)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setError(null)
      setResult(null)
    }
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file) return
    setUploading(true)
    setError(null)

    try {
      // In a real implementation, the file would be uploaded to Supabase Storage
      // and then parsed server-side. For now, we simulate the storage path and
      // call the server action to create the bank_upload_files record.
      const storagePath = `bank-uploads/${companyId}/${Date.now()}-${file.name}`

      // Simulated parse result — in production, the server would parse the file
      const parseResult: ParseResult = {
        transactionCount: 0,
        periodFrom: null,
        periodTo: null,
      }

      // Estimate transaction count from file size (rough heuristic)
      // ~200 bytes per transaction in XML, ~80 bytes in CSV
      const bytesPerTx = fileFormat === 'csv' ? 80 : 200
      parseResult.transactionCount = Math.max(1, Math.round(file.size / bytesPerTx))

      const uploadResult = await uploadBankFile({
        companyId,
        filename: file.name,
        fileFormat,
        storagePath,
        periodFrom: parseResult.periodFrom,
        periodTo: parseResult.periodTo,
        transactionCount: parseResult.transactionCount,
      })

      if (!uploadResult.success) {
        setError(uploadResult.error ?? 'Upload fehlgeschlagen.')
        setUploading(false)
        return
      }

      // Simulated matching result — in production this would be computed server-side
      const matched = Math.floor(parseResult.transactionCount * 0.6)
      const unmatched = parseResult.transactionCount - matched

      setResult({
        matched,
        unmatched,
        total: parseResult.transactionCount,
      })
    } catch (err) {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
    } finally {
      setUploading(false)
    }
  }, [file, fileFormat, companyId])

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-semibold text-brand-text-primary mb-1">
        Bankdatei hochladen
      </h1>
      <p className="text-sm text-brand-text-secondary mb-6">
        Laden Sie eine Kontoauszugsdatei hoch, um Transaktionen mit geplanten
        Liquiditaetsereignissen abzugleichen.
      </p>

      {/* File format selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-brand-text-primary mb-2">
          Dateiformat
        </label>
        <div className="flex gap-3">
          {[
            { value: 'camt053' as const, label: 'CAMT.053 (XML)' },
            { value: 'mt940' as const, label: 'MT940 (SWIFT)' },
            { value: 'csv' as const, label: 'CSV' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFileFormat(opt.value)}
              className={`rounded-brand border px-4 py-2 text-sm font-medium transition-colors ${
                fileFormat === opt.value
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                  : 'border-gray-200 bg-brand-surface text-brand-text-primary hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`relative rounded-brand border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? 'border-[var(--brand-primary)] bg-blue-50'
            : file
            ? 'border-green-300 bg-green-50'
            : 'border-gray-300 bg-brand-surface'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xml,.csv,.txt,.sta"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Bankdatei auswaehlen"
        />

        {file ? (
          <div>
            <svg
              className="mx-auto h-10 w-10 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="mt-2 text-sm font-medium text-brand-text-primary">
              {file.name}
            </p>
            <p className="text-xs text-brand-text-secondary mt-1">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setResult(null)
              }}
              className="mt-3 text-xs text-brand-text-secondary underline hover:text-brand-text-primary"
            >
              Andere Datei waehlen
            </button>
          </div>
        ) : (
          <div>
            <svg
              className="mx-auto h-10 w-10 text-brand-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mt-2 text-sm text-brand-text-primary">
              Datei hier ablegen oder{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-[var(--brand-primary)] underline"
              >
                durchsuchen
              </button>
            </p>
            <p className="mt-1 text-xs text-brand-text-secondary">
              CAMT.053 (XML), MT940, oder CSV
            </p>
          </div>
        )}
      </div>

      {/* Upload button */}
      {file && !result && (
        <div className="mt-6">
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="w-full rounded-brand bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? 'Wird hochgeladen...' : 'Hochladen und abgleichen'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-brand bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-medium text-brand-text-primary">
            Ergebnis
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-brand bg-brand-surface border border-gray-200 p-4 text-center">
              <p className="text-2xl font-semibold text-brand-text-primary">
                {result.total}
              </p>
              <p className="text-xs text-brand-text-secondary mt-1">
                Transaktionen geparst
              </p>
            </div>
            <div className="rounded-brand bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-2xl font-semibold text-green-700">
                {result.matched}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Zugeordnet
              </p>
            </div>
            <div className="rounded-brand bg-amber-50 border border-amber-200 p-4 text-center">
              <p className="text-2xl font-semibold text-amber-700">
                {result.unmatched}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Nicht zugeordnet
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => router.push(`/liquidity/${companyId}`)}
              className="flex-1 rounded-brand bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              Zur Liquiditaetsplanung
            </button>
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setResult(null)
              }}
              className="rounded-brand border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-text-primary transition-colors hover:bg-gray-50"
            >
              Weitere Datei
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
