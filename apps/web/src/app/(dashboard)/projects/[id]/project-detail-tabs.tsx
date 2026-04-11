'use client'

import { useState } from 'react'

interface Props {
  project: Record<string, unknown>
  lead: Record<string, unknown> | null
  offer: Record<string, unknown> | null
  phaseHistory: Array<Record<string, unknown>>
  processInstances: Array<Record<string, unknown>>
  liqEvents: Array<Record<string, unknown>>
  incomingInvoices: Array<Record<string, unknown>>
  outgoingInvoices: Array<Record<string, unknown>>
  documents: Array<Record<string, unknown>>
}

type Tab = 'uebersicht' | 'zeitachse' | 'finanzen' | 'dokumente' | 'prozesse'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'zeitachse', label: 'Zeitachse' },
  { id: 'finanzen', label: 'Finanzen' },
  { id: 'dokumente', label: 'Dokumente' },
  { id: 'prozesse', label: 'Prozesse' },
]

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  return `CHF ${Number(n).toLocaleString('de-CH', { minimumFractionDigits: 2 })}`
}

export function ProjectDetailTabs({ project, lead, offer, phaseHistory, processInstances, liqEvents, incomingInvoices, outgoingInvoices, documents }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('uebersicht')

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'uebersicht' && (
        <div className="space-y-6">
          {/* Project info */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Projektdaten</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Projekttitel:</span> <span className="font-medium">{project['title'] as string}</span></div>
              <div><span className="text-gray-500">Kunde:</span> <span className="font-medium">{project['customer_name'] as string}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className="font-medium">{project['status'] as string}</span></div>
              <div><span className="text-gray-500">Projektwert:</span> <span className="font-medium">{fmtCHF(project['project_value'] as number | null)}</span></div>
              <div><span className="text-gray-500">Anlagengröße:</span> <span className="font-medium">{project['system_size_kwp'] ? `${project['system_size_kwp']} kWp` : '—'}</span></div>
              <div><span className="text-gray-500">Projektstart:</span> <span className="font-medium">{fmtDate(project['project_start_date'] as string | null)}</span></div>
              <div><span className="text-gray-500">Installationsdatum:</span> <span className="font-medium">{fmtDate(project['installation_date'] as string | null)}</span></div>
              <div><span className="text-gray-500">Abschlussdatum:</span> <span className="font-medium">{fmtDate(project['completion_date'] as string | null)}</span></div>
              <div><span className="text-gray-500">Erstellt:</span> <span className="font-medium">{fmtDate(project['created_at'] as string)}</span></div>
              <div><span className="text-gray-500">Externe ID:</span> <span className="font-medium font-mono">{(project['external_id'] as string) || '—'}</span></div>
            </div>
            {(project['description'] as string | null) ? (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Beschreibung</p>
                <p className="text-sm text-gray-700">{project['description'] as string}</p>
              </div>
            ) : null}
            {(project['notes'] as string | null) ? (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Notizen</p>
                <p className="text-sm text-gray-700">{project['notes'] as string}</p>
              </div>
            ) : null}
          </div>

          {/* Lead info */}
          {lead && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Lead-Daten</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Name:</span> <span className="font-medium">{String(lead['first_name'] ?? '')} {String(lead['last_name'] ?? '')}</span></div>
                <div><span className="text-gray-500">E-Mail:</span> <span className="font-medium">{String(lead['email'] ?? '—')}</span></div>
                <div><span className="text-gray-500">Telefon:</span> <span className="font-medium">{String(lead['phone'] ?? '—')}</span></div>
                <div><span className="text-gray-500">Quelle:</span> <span className="font-medium">{String(lead['source'] ?? '—')}</span></div>
                <div><span className="text-gray-500">Status:</span> <span className="font-medium">{String(lead['status'] ?? '—')}</span></div>
                <div><span className="text-gray-500">Qualifiziert:</span> <span className="font-medium">{fmtDate(lead['qualified_at'] as string | null)}</span></div>
              </div>
            </div>
          )}

          {/* Offer info */}
          {offer && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Angebot</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Titel:</span> <span className="font-medium">{String(offer['title'] ?? '—')}</span></div>
                <div><span className="text-gray-500">Betrag:</span> <span className="font-medium">{fmtCHF(offer['amount_chf'] as number | null)}</span></div>
                <div><span className="text-gray-500">Status:</span> <span className="font-medium">{String(offer['status'] ?? '—')}</span></div>
                <div><span className="text-gray-500">Gesendet:</span> <span className="font-medium">{fmtDate(offer['sent_at'] as string | null)}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'zeitachse' && (
        <div className="space-y-3">
          {phaseHistory.length === 0 && liqEvents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Noch keine Ereignisse aufgezeichnet.</p>
          ) : (
            <div className="relative border-l-2 border-gray-200 pl-6 space-y-4">
              {/* Phase transitions */}
              {phaseHistory.map((ph, i) => (
                <div key={`ph-${i}`} className="relative">
                  <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full bg-blue-500 border-2 border-white" />
                  <p className="text-sm font-medium text-gray-900">Phase {String(ph['from_phase'] ?? '—')} → {String(ph['to_phase'] ?? '')}</p>
                  {ph['note'] ? <p className="text-xs text-gray-500">{String(ph['note'])}</p> : null}
                  <p className="text-xs text-gray-400">{fmtDate(ph['created_at'] as string)}</p>
                </div>
              ))}
              {/* Financial events */}
              {liqEvents.map((evt, i) => (
                <div key={`liq-${i}`} className="relative">
                  <div className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white ${evt['direction'] === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <p className="text-sm font-medium text-gray-900">
                    {evt['step_name'] as string}
                    <span className={`ml-2 text-xs font-normal ${evt['direction'] === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {evt['direction'] === 'income' ? '+' : '-'}{fmtCHF(evt['budget_amount'] as number)}
                    </span>
                  </p>
                  {(evt['actual_amount'] as number | null) ? (
                    <p className="text-xs text-gray-500">Ist: {fmtCHF(evt['actual_amount'] as number)} (Δ {fmtCHF(evt['amount_deviation'] as number)})</p>
                  ) : null}
                  <p className="text-xs text-gray-400">Budget: {fmtDate(evt['budget_date'] as string | null)} {(evt['actual_date'] as string | null) ? `· Ist: ${fmtDate(evt['actual_date'] as string)}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'finanzen' && (
        <div className="space-y-6">
          {/* Liquidity events */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <h3 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">Liquiditätsereignisse</h3>
            {liqEvents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Keine Ereignisse.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Schritt</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Richtung</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Budget</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Ist</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Abweichung</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Datum (Budget)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Datum (Ist)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {liqEvents.map((evt, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">{evt['step_name'] as string}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${evt['direction'] === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {evt['direction'] === 'income' ? 'Einnahme' : 'Ausgabe'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{fmtCHF(evt['budget_amount'] as number)}</td>
                      <td className="px-4 py-2 text-right font-mono">{evt['actual_amount'] ? fmtCHF(evt['actual_amount'] as number) : '—'}</td>
                      <td className="px-4 py-2 text-right font-mono">{evt['amount_deviation'] ? fmtCHF(evt['amount_deviation'] as number) : '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{fmtDate(evt['budget_date'] as string | null)}</td>
                      <td className="px-4 py-2 text-gray-500">{evt['actual_date'] ? fmtDate(evt['actual_date'] as string) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Supplier invoices */}
          {incomingInvoices.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">Lieferantenrechnungen ({incomingInvoices.length})</h3>
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nr.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Lieferant</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Betrag</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Fälligkeit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {incomingInvoices.map((inv) => (
                    <tr key={inv['id'] as string} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-blue-600">{String(inv['invoice_number'] ?? '—')}</td>
                      <td className="px-4 py-2 text-gray-900">{String(inv['sender_name'] ?? '—')}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtCHF(inv['gross_amount'] as number)}</td>
                      <td className="px-4 py-2"><span className="text-xs">{String(inv['status'] ?? '—')}</span></td>
                      <td className="px-4 py-2 text-gray-500">{fmtDate(inv['due_date'] as string | null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'dokumente' && (
        <div>
          {documents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <svg className="mx-auto mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-500 mb-1">Noch keine Dokumente vorhanden.</p>
              <p className="text-xs text-gray-400">Dokument-Upload wird in einem späteren Schritt aktiviert.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map((doc) => (
                <div key={doc['id'] as string} className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc['title'] as string}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{doc['document_type'] as string}</p>
                  <p className="text-xs text-gray-400 mt-1">{fmtDate(doc['created_at'] as string)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'prozesse' && (
        <div className="space-y-3">
          {processInstances.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Keine Prozessinstanzen.</p>
          ) : (
            processInstances.map((inst) => (
              <div key={inst['id'] as string} className="rounded-lg border border-gray-200 bg-white p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Prozess v{inst['process_version'] as string}</p>
                  <p className="text-xs text-gray-500">Gestartet: {fmtDate(inst['started_at'] as string)}</p>
                  {(inst['completed_at'] as string | null) ? <p className="text-xs text-gray-500">Abgeschlossen: {fmtDate(inst['completed_at'] as string)}</p> : null}
                </div>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  inst['status'] === 'active' ? 'bg-green-100 text-green-700' :
                  inst['status'] === 'completed' ? 'bg-gray-100 text-gray-600' :
                  'bg-red-100 text-red-700'
                }`}>
                  {inst['status'] as string}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
