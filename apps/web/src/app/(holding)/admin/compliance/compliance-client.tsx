'use client'

import { useState, useTransition, useRef } from 'react'
import {
  fulfillCheck,
  waiveCheck,
  uploadDocument,
  getDocumentUrl,
} from './actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'uebersicht' | 'pruefpunkte' | 'dokumente'

interface ComplianceCheck {
  id: string
  rule_code: string
  rule_title: string
  status: string
  severity: string
  triggered_at: string
  due_at: string
  fulfilled_at: string | null
  company_name: string | null
  notes: string | null
  requirement: string
}

interface ComplianceDocument {
  id: string
  title: string
  document_type: string
  storage_path: string
  file_size: number
  mime_type: string
  valid_from: string | null
  expires_at: string | null
  uploaded_at: string
  company_name: string | null
}

interface Certification {
  id: string
  certification: string
  level: string
  status: string
  certified_at: string | null
  expires_at: string | null
  notes: string | null
}

interface ComplianceClientProps {
  checks: ComplianceCheck[]
  documents: ComplianceDocument[]
  certifications: Certification[]
  summary: {
    openChecks: number
    overdueChecks: number
    upcomingCertRenewals: number
    fulfilledChecks: number
    totalDocuments: number
    expiringDocuments: number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TABS: { key: Tab; label: string }[] = [
  { key: 'uebersicht', label: 'Übersicht' },
  { key: 'pruefpunkte', label: 'Prüfpunkte' },
  { key: 'dokumente', label: 'Dokumente' },
]

const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  fulfilled: 'Erfüllt',
  overdue: 'Überfällig',
  waived: 'Zurückgestellt',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  fulfilled: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  waived: 'bg-gray-100 text-gray-600',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  info: 'bg-blue-100 text-blue-700',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  avv: 'AVV',
  dpa: 'DPA',
  dsfa: 'DSFA',
  tom: 'TOM',
  certificate: 'Zertifikat',
  audit_report: 'Audit-Bericht',
  vvt: 'VVT',
  consent_form: 'Einwilligungsformular',
  other: 'Sonstiges',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isExpiringSoon(dateStr: string | null, days: number = 30): boolean {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - Date.now()
  return diff > 0 && diff < days * 24 * 60 * 60 * 1000
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr).getTime() < Date.now()
}

function ragStatus(summary: ComplianceClientProps['summary']): 'green' | 'amber' | 'red' {
  if (summary.overdueChecks > 0) return 'red'
  if (summary.openChecks > 3 || summary.expiringDocuments > 0 || summary.upcomingCertRenewals > 0) return 'amber'
  return 'green'
}

const RAG_CONFIG = {
  green: { label: 'Konform', bg: 'bg-green-50 border-green-200', text: 'text-green-800', dot: 'bg-green-500' },
  amber: { label: 'Achtung', bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  red: { label: 'Kritisch', bg: 'bg-red-50 border-red-200', text: 'text-red-800', dot: 'bg-red-500' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComplianceClient({ checks, documents, certifications, summary }: ComplianceClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('uebersicht')
  const [isPending, startTransition] = useTransition()
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [waiveCheckId, setWaiveCheckId] = useState<string | null>(null)
  const [waiveReason, setWaiveReason] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // --- Action handlers ---

  function handleFulfill(checkId: string) {
    startTransition(async () => {
      const res = await fulfillCheck(checkId)
      setActionMessage(res.success
        ? { type: 'success', text: 'Prüfpunkt als erfüllt markiert.' }
        : { type: 'error', text: res.error ?? 'Unbekannter Fehler' })
    })
  }

  function handleWaive() {
    if (!waiveCheckId || !waiveReason.trim()) return
    startTransition(async () => {
      const res = await waiveCheck(waiveCheckId, waiveReason)
      setActionMessage(res.success
        ? { type: 'success', text: 'Prüfpunkt zurückgestellt.' }
        : { type: 'error', text: res.error ?? 'Unbekannter Fehler' })
      setWaiveCheckId(null)
      setWaiveReason('')
    })
  }

  function handleUpload(formData: FormData) {
    startTransition(async () => {
      const res = await uploadDocument(formData)
      setActionMessage(res.success
        ? { type: 'success', text: 'Dokument hochgeladen.' }
        : { type: 'error', text: res.error ?? 'Unbekannter Fehler' })
      if (res.success) {
        setShowUpload(false)
        formRef.current?.reset()
      }
    })
  }

  async function handleDownload(storagePath: string) {
    const res = await getDocumentUrl(storagePath)
    if (res.url) {
      window.open(res.url, '_blank')
    } else {
      setActionMessage({ type: 'error', text: res.error ?? 'Download fehlgeschlagen.' })
    }
  }

  // --- RAG ---
  const rag = ragStatus(summary)
  const ragConfig = RAG_CONFIG[rag]

  return (
    <div>
      {/* Action message banner */}
      {actionMessage && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            actionMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {actionMessage.text}
          <button
            onClick={() => setActionMessage(null)}
            className="ml-3 font-medium underline"
          >
            Schließen
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ================================================================= */}
      {/* Tab: Übersicht */}
      {/* ================================================================= */}
      {activeTab === 'uebersicht' && (
        <div className="space-y-6">
          {/* RAG Status */}
          <div className={`rounded-lg border p-4 ${ragConfig.bg}`}>
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${ragConfig.dot}`} />
              <span className={`text-lg font-semibold ${ragConfig.text}`}>
                Compliance-Status: {ragConfig.label}
              </span>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard
              label="Offene Prüfpunkte"
              value={summary.openChecks}
              color={summary.openChecks > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              label="Überfällige Prüfpunkte"
              value={summary.overdueChecks}
              color={summary.overdueChecks > 0 ? 'red' : 'green'}
            />
            <SummaryCard
              label="Erfüllte Prüfpunkte"
              value={summary.fulfilledChecks}
              color="green"
            />
            <SummaryCard
              label="Zertifikat-Erneuerungen"
              value={summary.upcomingCertRenewals}
              color={summary.upcomingCertRenewals > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              label="Dokumente gesamt"
              value={summary.totalDocuments}
              color="blue"
            />
            <SummaryCard
              label="Ablaufende Dokumente"
              value={summary.expiringDocuments}
              color={summary.expiringDocuments > 0 ? 'red' : 'green'}
            />
          </div>

          {/* Overdue list preview */}
          {summary.overdueChecks > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="text-sm font-semibold text-red-900 mb-2">
                Überfällige Prüfpunkte
              </h3>
              <ul className="space-y-1">
                {checks
                  .filter((c) => c.status === 'overdue')
                  .slice(0, 5)
                  .map((c) => (
                    <li key={c.id} className="text-sm text-red-700">
                      {c.rule_title} — fällig seit {formatDate(c.due_at)}
                      {c.company_name && ` (${c.company_name})`}
                    </li>
                  ))}
              </ul>
              {summary.overdueChecks > 5 && (
                <button
                  onClick={() => setActiveTab('pruefpunkte')}
                  className="mt-2 text-sm font-medium text-red-800 underline"
                >
                  Alle anzeigen
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* Tab: Prüfpunkte */}
      {/* ================================================================= */}
      {activeTab === 'pruefpunkte' && (
        <div>
          {/* Waive dialog */}
          {waiveCheckId && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Prüfpunkt zurückstellen
              </h3>
              <textarea
                className="w-full rounded-md border border-gray-300 p-2 text-sm"
                rows={3}
                placeholder="Begründung eingeben..."
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleWaive}
                  disabled={isPending || !waiveReason.trim()}
                  className="rounded-md bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  Bestätigen
                </button>
                <button
                  onClick={() => { setWaiveCheckId(null); setWaiveReason('') }}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {checks.length === 0 ? (
            <p className="text-sm text-gray-500">Keine Prüfpunkte vorhanden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 pr-4 font-medium">Regel</th>
                    <th className="pb-2 pr-4 font-medium">Unternehmen</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Schwere</th>
                    <th className="pb-2 pr-4 font-medium">Fällig</th>
                    <th className="pb-2 pr-4 font-medium">Anforderung</th>
                    <th className="pb-2 font-medium">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {checks.map((check) => (
                    <tr key={check.id} className="align-top">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-gray-900">{check.rule_title}</span>
                        <br />
                        <span className="text-xs text-gray-400">{check.rule_code}</span>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {check.company_name ?? 'Holding'}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[check.status] ?? ''}`}>
                          {STATUS_LABELS[check.status] ?? check.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[check.severity] ?? ''}`}>
                          {check.severity}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {formatDate(check.due_at)}
                        {check.fulfilled_at && (
                          <span className="block text-xs text-green-600">
                            Erfüllt: {formatDate(check.fulfilled_at)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 max-w-xs truncate" title={check.requirement}>
                        {check.requirement}
                      </td>
                      <td className="py-3">
                        {check.status === 'open' || check.status === 'overdue' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleFulfill(check.id)}
                              disabled={isPending}
                              className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Erfüllen
                            </button>
                            <button
                              onClick={() => setWaiveCheckId(check.id)}
                              disabled={isPending}
                              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Zurückstellen
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* Tab: Dokumente */}
      {/* ================================================================= */}
      {activeTab === 'dokumente' && (
        <div>
          {/* Upload form */}
          <div className="mb-6">
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Dokument hochladen
            </button>

            {showUpload && (
              <form
                ref={formRef}
                action={handleUpload}
                className="mt-4 rounded-lg border border-gray-200 bg-white p-4 space-y-3"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="doc-title" className="block text-sm font-medium text-gray-700 mb-1">
                      Titel
                    </label>
                    <input
                      id="doc-title"
                      name="title"
                      type="text"
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="doc-type" className="block text-sm font-medium text-gray-700 mb-1">
                      Dokumenttyp
                    </label>
                    <select
                      id="doc-type"
                      name="document_type"
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="doc-valid-from" className="block text-sm font-medium text-gray-700 mb-1">
                      Gültig ab
                    </label>
                    <input
                      id="doc-valid-from"
                      name="valid_from"
                      type="date"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="doc-expires" className="block text-sm font-medium text-gray-700 mb-1">
                      Läuft ab am
                    </label>
                    <input
                      id="doc-expires"
                      name="expires_at"
                      type="date"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="doc-file" className="block text-sm font-medium text-gray-700 mb-1">
                    Datei
                  </label>
                  <input
                    id="doc-file"
                    name="file"
                    type="file"
                    required
                    className="w-full text-sm"
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.txt"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isPending ? 'Wird hochgeladen...' : 'Hochladen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUpload(false)}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Document list */}
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500">Keine Dokumente vorhanden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 pr-4 font-medium">Titel</th>
                    <th className="pb-2 pr-4 font-medium">Typ</th>
                    <th className="pb-2 pr-4 font-medium">Unternehmen</th>
                    <th className="pb-2 pr-4 font-medium">Größe</th>
                    <th className="pb-2 pr-4 font-medium">Gültig ab</th>
                    <th className="pb-2 pr-4 font-medium">Läuft ab</th>
                    <th className="pb-2 pr-4 font-medium">Hochgeladen</th>
                    <th className="pb-2 font-medium">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map((doc) => {
                    const expired = isExpired(doc.expires_at)
                    const expiring = !expired && isExpiringSoon(doc.expires_at)
                    return (
                      <tr key={doc.id} className="align-top">
                        <td className="py-3 pr-4 font-medium text-gray-900">{doc.title}</td>
                        <td className="py-3 pr-4 text-gray-600">
                          {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {doc.company_name ?? 'Holding'}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{formatFileSize(doc.file_size)}</td>
                        <td className="py-3 pr-4 text-gray-600">
                          {doc.valid_from ? formatDate(doc.valid_from) : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          {doc.expires_at ? (
                            <span className={
                              expired
                                ? 'text-red-700 font-medium'
                                : expiring
                                  ? 'text-yellow-700 font-medium'
                                  : 'text-gray-600'
                            }>
                              {formatDate(doc.expires_at)}
                              {expired && ' (abgelaufen)'}
                              {expiring && ' (bald)'}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{formatDate(doc.uploaded_at)}</td>
                        <td className="py-3">
                          <button
                            onClick={() => handleDownload(doc.storage_path)}
                            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Herunterladen
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary card sub-component
// ---------------------------------------------------------------------------

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'border-green-200 bg-green-50 text-green-900',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
  }

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color] ?? colorClasses['blue']}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
