'use client'

import { useState } from 'react'

export function AnomalyScanButton() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<{
    detected: number
    inserted: number
    resolved: number
  } | null>(null)

  async function handleScan() {
    setScanning(true)
    setResult(null)
    try {
      const res = await fetch('/api/anomaly-scan', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setResult({
          detected: data.detected,
          inserted: data.inserted,
          resolved: data.resolved,
        })
        // Reload page to show updated anomalies
        if (data.inserted > 0 || data.resolved > 0) {
          setTimeout(() => window.location.reload(), 1500)
        }
      }
    } catch (err) {
      console.error('Scan failed:', err)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleScan}
        disabled={scanning}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
        style={{ backgroundColor: '#1A56DB' }}
      >
        {scanning ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Scanne...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Anomalie-Scan starten
          </>
        )}
      </button>
      {result && (
        <span className="text-xs text-brand-text-secondary">
          {result.detected} erkannt, {result.inserted} neu, {result.resolved} behoben
        </span>
      )}
    </div>
  )
}
