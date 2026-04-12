'use client'

import { useState, useRef, useTransition } from 'react'
import { uploadProjectDocument, deleteProjectDocument } from './actions'

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
  calls: Array<Record<string, unknown>>
  calendarEvents: Array<Record<string, unknown>>
}

type Tab = 'uebersicht' | 'zeitachse' | 'finanzen' | 'setter' | 'berater' | 'dokumente' | 'prozesse'
type SelectedEvent = { evt: Record<string, unknown>; invoice: Record<string, unknown> | null } | null

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'zeitachse', label: 'Zeitachse' },
  { id: 'finanzen', label: 'Finanzen' },
  { id: 'setter', label: 'Setter' },
  { id: 'berater', label: 'Berater' },
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

export function ProjectDetailTabs({ project, lead, offer, phaseHistory, processInstances, liqEvents, incomingInvoices, outgoingInvoices, documents, calls, calendarEvents }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('uebersicht')
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent>(null)

  function handleEventClick(evt: Record<string, unknown>) {
    const invoiceId = evt['invoice_id'] as string | null
    const invoice = invoiceId
      ? incomingInvoices.find(inv => inv['id'] === invoiceId) ?? null
      : null
    setSelectedEvent({ evt, invoice })
  }

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
              <div><span className="text-gray-500">PV-Anlage:</span> <span className="font-medium">{project['system_size_kwp'] ? `${project['system_size_kwp']} kWp` : '—'}</span></div>
              <div><span className="text-gray-500">Wechselrichter:</span> <span className="font-medium">{project['inverter_size_kw'] ? `${project['inverter_size_kw']} kW` : '—'}</span></div>
              <div><span className="text-gray-500">Wärmepumpe:</span> <span className="font-medium">{project['heatpump_size_kw'] ? `${project['heatpump_size_kw']} kW` : '—'}</span></div>
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
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Kum. Cashflow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    let cumulative = 0
                    return liqEvents.map((evt, i) => {
                      const amount = Number(evt['budget_amount'] ?? 0)
                      cumulative += evt['direction'] === 'income' ? amount : -amount
                      return (
                        <tr
                          key={i}
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                          onClick={() => handleEventClick(evt)}
                        >
                          <td className="px-4 py-2 text-blue-700 font-medium">{evt['step_name'] as string}</td>
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
                          <td className={`px-4 py-2 text-right font-mono font-semibold ${cumulative >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {fmtCHF(cumulative)}
                          </td>
                        </tr>
                      )
                    })
                  })()}
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

      {/* Setter tab */}
      {activeTab === 'setter' && (
        <div>
          {lead ? (
            <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              Setter: <span className="font-medium">{String(lead['setter_id'] ? 'Zugeordnet' : 'Nicht zugeordnet')}</span>
              {lead['phone'] ? <span className="ml-3">Kunden-Tel: <span className="font-mono">{String(lead['phone'])}</span></span> : null}
            </div>
          ) : null}
          {calls.length === 0 && calendarEvents.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-sm text-gray-500">Keine Setter-Kommunikation zu diesem Projekt.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Calls */}
              {calls.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <h3 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">Anrufe ({calls.length})</h3>
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Datum</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Richtung</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Dauer</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nummer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {calls.map((call, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900">{fmtDate(call['started_at'] as string)}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${call['direction'] === 'inbound' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                              {call['direction'] === 'inbound' ? 'Eingehend' : 'Ausgehend'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${call['status'] === 'answered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {call['status'] === 'answered' ? 'Beantwortet' : call['status'] === 'missed' ? 'Verpasst' : String(call['status'])}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-gray-500">
                            {call['duration_seconds'] ? `${Math.floor(Number(call['duration_seconds']) / 60)}:${String(Number(call['duration_seconds']) % 60).padStart(2, '0')}` : '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                            {String(call['direction'] === 'inbound' ? call['caller_number'] ?? '' : call['callee_number'] ?? '')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Calendar events */}
              {calendarEvents.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <h3 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">Termine ({calendarEvents.length})</h3>
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Datum</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Titel</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ort</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {calendarEvents.map((evt, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900">{fmtDate(evt['starts_at'] as string)}</td>
                          <td className="px-4 py-2 text-gray-900">{String(evt['title'] ?? '—')}</td>
                          <td className="px-4 py-2 text-gray-500">{String(evt['location'] ?? '—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Berater tab */}
      {activeTab === 'berater' && (
        <div>
          {project['berater_id'] ? (
            <div className="mb-4 rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-sm text-indigo-800">
              Berater zugeordnet
            </div>
          ) : null}
          <div className="space-y-6">
            {/* Berater calls */}
            {calls.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">Anrufe ({calls.length})</h3>
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Datum</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Richtung</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Dauer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {calls.map((call, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">{fmtDate(call['started_at'] as string)}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${call['direction'] === 'inbound' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {call['direction'] === 'inbound' ? 'Eingehend' : 'Ausgehend'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${call['status'] === 'answered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {call['status'] === 'answered' ? 'Beantwortet' : call['status'] === 'missed' ? 'Verpasst' : String(call['status'])}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-500">
                          {call['duration_seconds'] ? `${Math.floor(Number(call['duration_seconds']) / 60)}:${String(Number(call['duration_seconds']) % 60).padStart(2, '0')}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Berater calendar events */}
            {calendarEvents.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">Termine ({calendarEvents.length})</h3>
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Datum</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Titel</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ort</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {calendarEvents.map((evt, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">{fmtDate(evt['starts_at'] as string)}</td>
                        <td className="px-4 py-2 text-gray-900">{String(evt['title'] ?? '—')}</td>
                        <td className="px-4 py-2 text-gray-500">{String(evt['location'] ?? '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Offers */}
            {offer ? (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">Angebote</h3>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Titel</p>
                      <p className="font-medium">{String(offer['title'] ?? '—')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Betrag</p>
                      <p className="font-mono font-medium">{fmtCHF(offer['amount_chf'] as number)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <p className="font-medium">{String(offer['status'] ?? '—')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Gesendet</p>
                      <p>{fmtDate(offer['sent_at'] as string | null)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {calls.length === 0 && calendarEvents.length === 0 && !offer && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-sm text-gray-500">Keine Berater-Kommunikation zu diesem Projekt.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dokumente' && (
        <DocumentsTab projectId={project['id'] as string} documents={documents} />
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
      {/* Event detail popup */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedEvent(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h3 className="text-sm font-bold text-gray-900">{String(selectedEvent.evt['step_name'] ?? '')}</h3>
              <button type="button" onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Event details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Richtung</p>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-0.5 ${selectedEvent.evt['direction'] === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {selectedEvent.evt['direction'] === 'income' ? 'Einnahme' : 'Ausgabe'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Budget</p>
                  <p className="font-mono font-medium">{fmtCHF(selectedEvent.evt['budget_amount'] as number)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ist-Betrag</p>
                  <p className="font-mono font-medium">{selectedEvent.evt['actual_amount'] ? fmtCHF(selectedEvent.evt['actual_amount'] as number) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fälligkeitsdatum</p>
                  <p>{fmtDate(selectedEvent.evt['budget_date'] as string | null)}</p>
                </div>
              </div>

              {/* Linked invoice */}
              {selectedEvent.invoice ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <h4 className="text-xs font-semibold text-blue-800 mb-2">Verknüpfte Rechnung</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-blue-600">Rechnungsnr.</p>
                      <p className="font-medium text-blue-900">{String(selectedEvent.invoice['invoice_number'] ?? '—')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600">Lieferant</p>
                      <p className="font-medium text-blue-900">{String(selectedEvent.invoice['sender_name'] ?? '—')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600">Bruttobetrag</p>
                      <p className="font-mono font-medium text-blue-900">
                        {String(selectedEvent.invoice['currency'] ?? 'CHF')} {Number(selectedEvent.invoice['gross_amount'] ?? 0).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600">Status</p>
                      <p className="font-medium text-blue-900">{String(selectedEvent.invoice['status'] ?? '—')}</p>
                    </div>
                  </div>
                  {selectedEvent.invoice['raw_storage_path'] ? (
                    <a
                      href={`/finanzplanung/eingang/${String(selectedEvent.invoice['id'])}`}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Rechnung & Scan ansehen
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">Keine Rechnung verknüpft.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Documents Tab with upload
// ---------------------------------------------------------------------------

const DOC_TYPES = [
  { value: 'photo', label: 'Foto' },
  { value: 'drawing', label: 'Zeichnung / Plan' },
  { value: 'contract', label: 'Vertrag' },
  { value: 'offer', label: 'Angebot' },
  { value: 'invoice_customer', label: 'Kundenrechnung' },
  { value: 'invoice_supplier', label: 'Lieferantenrechnung' },
  { value: 'email', label: 'E-Mail' },
  { value: 'voice_note', label: 'Sprachnotiz' },
  { value: 'video', label: 'Video' },
  { value: 'report', label: 'Bericht' },
  { value: 'other', label: 'Sonstiges' },
]

function DocumentsTab({ projectId, documents }: { projectId: string; documents: Array<Record<string, unknown>> }) {
  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('photo')
  const [file, setFile] = useState<File | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleUpload() {
    if (!file || !title) return
    const formData = new FormData()
    formData.append('projectId', projectId)
    formData.append('documentType', docType)
    formData.append('title', title)
    formData.append('file', file)

    startTransition(async () => {
      setFeedback(null)
      const result = await uploadProjectDocument(formData)
      if (result.success) {
        setFeedback({ type: 'success', message: 'Dokument erfolgreich hochgeladen.' })
        setTitle('')
        setFile(null)
        setShowUpload(false)
        if (fileRef.current) fileRef.current.value = ''
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Fehler beim Upload.' })
      }
    })
  }

  function handleDelete(docId: string, docTitle: string) {
    if (!confirm(`"${docTitle}" löschen?`)) return
    startTransition(async () => {
      await deleteProjectDocument(docId, projectId)
      setFeedback({ type: 'success', message: 'Dokument gelöscht.' })
    })
  }

  function formatSize(bytes: number | null): string {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      {feedback && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.message}
        </div>
      )}

      {/* Upload form */}
      {showUpload ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Dokument hochladen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Titel *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Dachfoto Nord" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Typ</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Datei * (max. 20 MB)</label>
              <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={isPending || !file || !title} onClick={handleUpload} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {isPending ? 'Wird hochgeladen...' : 'Hochladen'}
            </button>
            <button type="button" onClick={() => setShowUpload(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowUpload(true)} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 mb-6">
          + Dokument hochladen
        </button>
      )}

      {/* Document list */}
      {documents.length === 0 && !showUpload ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-gray-500 mb-1">Noch keine Dokumente vorhanden.</p>
          <p className="text-xs text-gray-400">Klicken Sie oben auf &quot;+ Dokument hochladen&quot;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {documents.map((doc) => (
            <div key={doc['id'] as string} className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{String(doc['title'] ?? '')}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {DOC_TYPES.find(t => t.value === doc['document_type'])?.label ?? String(doc['document_type'] ?? '')}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {doc['filename'] ? <p className="text-[10px] text-gray-400 truncate">{String(doc['filename'])}</p> : null}
                    {doc['file_size'] ? <p className="text-[10px] text-gray-400">{formatSize(doc['file_size'] as number)}</p> : null}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(doc['created_at'] as string)}</p>
                </div>
                <button type="button" onClick={() => handleDelete(doc['id'] as string, String(doc['title'] ?? ''))} className="text-xs text-red-500 hover:text-red-700 ml-2 shrink-0">
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
