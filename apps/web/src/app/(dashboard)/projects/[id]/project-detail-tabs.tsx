'use client'

import { useState, useRef, useTransition } from 'react'
import { uploadProjectDocument, deleteProjectDocument } from './actions'

interface Props {
  project: Record<string, unknown>
  lead: Record<string, unknown> | null
  offer: Record<string, unknown> | null
  berater: Record<string, unknown> | null
  setter: Record<string, unknown> | null
  phaseHistory: Array<Record<string, unknown>>
  timelineMilestones: Array<Record<string, unknown>>
  processInstances: Array<Record<string, unknown>>
  liqEvents: Array<Record<string, unknown>>
  incomingInvoices: Array<Record<string, unknown>>
  outgoingInvoices: Array<Record<string, unknown>>
  documents: Array<Record<string, unknown>>
  calls: Array<Record<string, unknown>>
  calendarEvents: Array<Record<string, unknown>>
}

type Tab = 'uebersicht' | 'zeitachse' | 'finanzen' | 'guv' | 'dokumente' | 'prozesse'
type SelectedEvent = { evt: Record<string, unknown>; invoice: Record<string, unknown> | null } | null

const ALL_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'zeitachse', label: 'Zeitachse' },
  { id: 'finanzen', label: 'Finanzen' },
  { id: 'guv', label: 'GuV Projekt' },
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

export function ProjectDetailTabs({ project, lead, offer, berater, setter, phaseHistory, timelineMilestones, processInstances, liqEvents, incomingInvoices, outgoingInvoices, documents, calls, calendarEvents }: Props) {
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
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {ALL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
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
        <div className="space-y-5">
          {/* Berater & Setter side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Berater</h3>
              </div>
              {berater ? (
                <div>
                  <p className="text-base font-bold text-indigo-900">{String(berater['first_name'] ?? '')} {String(berater['last_name'] ?? '')}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    {berater['email'] ? <span className="text-xs text-indigo-700">{String(berater['email'])}</span> : null}
                    {berater['phone'] ? <span className="text-xs text-indigo-700 font-mono">{String(berater['phone'])}</span> : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-indigo-500 italic">Nicht zugeordnet</p>
              )}
            </div>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-4 w-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <h3 className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Setter</h3>
              </div>
              {setter ? (
                <div>
                  <p className="text-base font-bold text-teal-900">{String(setter['first_name'] ?? '')} {String(setter['last_name'] ?? '')}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    {setter['email'] ? <span className="text-xs text-teal-700">{String(setter['email'])}</span> : null}
                    {setter['phone'] ? <span className="text-xs text-teal-700 font-mono">{String(setter['phone'])}</span> : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-teal-500 italic">Nicht zugeordnet</p>
              )}
            </div>
          </div>

          {/* Lead + Offer side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Lead / Kunde */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Kunde / Lead</h3>
              {lead ? (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-gray-900">{String(lead['first_name'] ?? '')} {String(lead['last_name'] ?? '')}</p>
                  {lead['email'] ? <p className="text-gray-600 text-xs">{String(lead['email'])}</p> : null}
                  {lead['phone'] ? <p className="text-gray-600 text-xs font-mono">{String(lead['phone'])}</p> : null}
                  {(lead['address_street'] || lead['address_city']) ? (
                    <p className="text-gray-500 text-xs">{[lead['address_street'], lead['address_zip'], lead['address_city']].filter(Boolean).join(', ')}</p>
                  ) : null}
                  <div className="flex items-center gap-2 pt-1">
                    {lead['source'] ? <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{String(lead['source'])}</span> : null}
                    {lead['status'] ? <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">{String(lead['status'])}</span> : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Kein Lead verknüpft</p>
              )}
            </div>

            {/* Angebot */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Angebot</h3>
              {offer ? (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-gray-900">{String(offer['title'] ?? '—')}</p>
                  <p className="text-xl font-bold text-gray-900 font-mono">{fmtCHF(offer['amount_chf'] as number | null)}</p>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      offer['status'] === 'won' ? 'bg-green-100 text-green-700' :
                      offer['status'] === 'lost' ? 'bg-red-100 text-red-700' :
                      offer['status'] === 'sent' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {offer['status'] === 'won' ? 'Gewonnen' : offer['status'] === 'sent' ? 'Versendet' : offer['status'] === 'draft' ? 'Entwurf' : offer['status'] === 'lost' ? 'Verloren' : String(offer['status'] ?? '—')}
                    </span>
                    {offer['sent_at'] ? <span className="text-xs text-gray-400">Gesendet: {fmtDate(offer['sent_at'] as string)}</span> : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Kein Angebot verknüpft</p>
              )}
            </div>
          </div>

          {/* Project technical details — only show fields that have values */}
          {(() => {
            const fields: Array<{ label: string; value: string | null }> = [
              { label: 'PV-Anlage', value: project['system_size_kwp'] ? `${project['system_size_kwp']} kWp` : null },
              { label: 'Wechselrichter', value: project['inverter_size_kw'] ? `${project['inverter_size_kw']} kW` : null },
              { label: 'Wärmepumpe', value: project['heatpump_size_kw'] ? `${project['heatpump_size_kw']} kW` : null },
              { label: 'Projektstart', value: project['project_start_date'] ? fmtDate(project['project_start_date'] as string) : null },
              { label: 'Installationsdatum', value: project['installation_date'] ? fmtDate(project['installation_date'] as string) : null },
              { label: 'Abschlussdatum', value: project['completion_date'] ? fmtDate(project['completion_date'] as string) : null },
              { label: 'Erstellt', value: fmtDate(project['created_at'] as string) },
            ]
            const filledFields = fields.filter(f => f.value)
            if (filledFields.length === 0) return null
            return (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Projektdaten</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {filledFields.map((f) => (
                    <div key={f.label}>
                      <p className="text-xs text-gray-400">{f.label}</p>
                      <p className="font-medium text-gray-900">{f.value}</p>
                    </div>
                  ))}
                </div>
                {(project['description'] as string | null) ? (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Beschreibung</p>
                    <p className="text-sm text-gray-700">{project['description'] as string}</p>
                  </div>
                ) : null}
                {(project['notes'] as string | null) ? (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-1">Notizen</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{project['notes'] as string}</p>
                  </div>
                ) : null}
              </div>
            )
          })()}

          {/* Calls linked to this project */}
          {calls.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">Anrufe ({calls.length})</h3>
              <div className="divide-y divide-gray-100">
                {calls.slice(0, 5).map((call, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${call['direction'] === 'inbound' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {call['direction'] === 'inbound' ? '↓ Ein' : '↑ Aus'}
                      </span>
                      <span className="text-gray-900">{fmtDate(call['started_at'] as string)}</span>
                      <span className={`text-xs ${call['status'] === 'answered' ? 'text-green-600' : 'text-red-500'}`}>
                        {call['status'] === 'answered' ? '✓' : '✗'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">
                      {call['duration_seconds'] ? `${Math.floor(Number(call['duration_seconds']) / 60)}:${String(Number(call['duration_seconds']) % 60).padStart(2, '0')}` : '—'}
                    </span>
                  </div>
                ))}
                {calls.length > 5 && <div className="px-4 py-2 text-xs text-gray-400 text-center">+ {calls.length - 5} weitere Anrufe</div>}
              </div>
            </div>
          )}

          {/* Calendar events linked to this project */}
          {calendarEvents.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">Termine ({calendarEvents.length})</h3>
              <div className="divide-y divide-gray-100">
                {calendarEvents.slice(0, 5).map((evt, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-900 font-medium">{String(evt['title'] ?? '—')}</span>
                      {evt['location'] ? <span className="text-xs text-gray-400 ml-2">· {String(evt['location'])}</span> : null}
                    </div>
                    <span className="text-xs text-gray-500">{fmtDate(evt['starts_at'] as string)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'zeitachse' && (
        <div className="space-y-3">
          {timelineMilestones.length === 0 && phaseHistory.length === 0 && liqEvents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Noch keine Ereignisse aufgezeichnet.</p>
          ) : (
            <div className="relative border-l-2 border-gray-200 pl-6 space-y-4">
              {/* Milestone events from integrations (lead, offer, project) */}
              {timelineMilestones.map((ms, i) => {
                const color = (ms['_color'] as string) ?? 'gray'
                const colorMap: Record<string, string> = {
                  teal: 'bg-teal-500', blue: 'bg-blue-500', indigo: 'bg-indigo-500',
                  green: 'bg-green-500', gray: 'bg-gray-400', red: 'bg-red-500',
                }
                return (
                  <div key={`ms-${i}`} className="relative">
                    <div className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white ${colorMap[color] ?? 'bg-gray-400'}`} />
                    <p className="text-sm font-medium text-gray-900">{String(ms['label'])}</p>
                    {ms['detail'] ? <p className="text-xs text-gray-500">{String(ms['detail'])}</p> : null}
                    <p className="text-xs text-gray-400">{fmtDate(ms['date'] as string)}</p>
                  </div>
                )
              })}
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
                    <p className="text-xs text-gray-500">Ist: {fmtCHF(evt['actual_amount'] as number)}</p>
                  ) : null}
                  <p className="text-xs text-gray-400">{fmtDate(evt['budget_date'] as string | null)}</p>
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
                      // Use best available amount: actual > scheduled > budget
                      const amount = Number(evt['actual_amount'] ?? evt['scheduled_amount'] ?? evt['budget_amount'] ?? 0)
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

      {/* GuV Projekt tab */}
      {activeTab === 'guv' && (() => {
        // Aggregate by step_name and direction
        interface GuvLine { budget: number; actual: number; costToCome: number; forecast: number }
        const incomeLines = new Map<string, GuvLine>()
        const expenseLines = new Map<string, GuvLine>()

        for (const evt of liqEvents) {
          const stepName = (evt['step_name'] as string) ?? 'Sonstige'
          const direction = evt['direction'] as string
          const budgetAmt = Number(evt['budget_amount'] ?? 0)
          const actualAmt = evt['actual_amount'] != null ? Number(evt['actual_amount']) : 0
          const hasActual = evt['actual_amount'] != null
          const ctc = hasActual ? 0 : budgetAmt

          const map = direction === 'income' ? incomeLines : expenseLines
          const existing = map.get(stepName) ?? { budget: 0, actual: 0, costToCome: 0, forecast: 0 }
          existing.budget += budgetAmt
          existing.actual += actualAmt
          existing.costToCome += ctc
          existing.forecast += actualAmt + ctc
          map.set(stepName, existing)
        }

        const sumLine = (map: Map<string, GuvLine>): GuvLine => {
          const total: GuvLine = { budget: 0, actual: 0, costToCome: 0, forecast: 0 }
          for (const v of map.values()) {
            total.budget += v.budget; total.actual += v.actual
            total.costToCome += v.costToCome; total.forecast += v.forecast
          }
          return total
        }

        const incomeTotal = sumLine(incomeLines)
        const expenseTotal = sumLine(expenseLines)
        const result: GuvLine = {
          budget: incomeTotal.budget - expenseTotal.budget,
          actual: incomeTotal.actual - expenseTotal.actual,
          costToCome: incomeTotal.costToCome - expenseTotal.costToCome,
          forecast: incomeTotal.forecast - expenseTotal.forecast,
        }
        const marginPct = incomeTotal.forecast > 0 ? (result.forecast / incomeTotal.forecast) * 100 : 0

        const renderRow = (label: string, line: GuvLine, bold = false) => (
          <tr key={label} className={bold ? 'font-semibold border-t border-gray-300' : 'hover:bg-gray-50'}>
            <td className={`px-4 py-2 ${bold ? 'text-gray-900' : 'text-gray-700'}`}>{label}</td>
            <td className="px-4 py-2 text-right font-mono">{fmtCHF(line.budget)}</td>
            <td className="px-4 py-2 text-right font-mono">{fmtCHF(line.actual)}</td>
            <td className="px-4 py-2 text-right font-mono">{fmtCHF(line.costToCome)}</td>
            <td className="px-4 py-2 text-right font-mono">{fmtCHF(line.forecast)}</td>
          </tr>
        )

        return (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Projekt-Budget</p>
                <p className={`text-lg font-bold mt-1 ${result.budget >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCHF(result.budget)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Forecast Ergebnis</p>
                <p className={`text-lg font-bold mt-1 ${result.forecast >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCHF(result.forecast)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Marge (Forecast)</p>
                <p className={`text-lg font-bold mt-1 ${marginPct >= 0 ? 'text-green-700' : 'text-red-600'}`}>{marginPct.toFixed(1)} %</p>
              </div>
            </div>

            {/* GuV table */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Position</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Budget</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Actual</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Cost to Come</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Forecast</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Revenue section */}
                  <tr className="bg-green-50">
                    <td colSpan={5} className="px-4 py-2 text-xs font-bold text-green-800 uppercase tracking-wide">Erlöse</td>
                  </tr>
                  {[...incomeLines.entries()].map(([name, line]) => renderRow(name, line))}
                  {renderRow('Summe Erlöse', incomeTotal, true)}

                  {/* Costs section */}
                  <tr className="bg-red-50">
                    <td colSpan={5} className="px-4 py-2 text-xs font-bold text-red-800 uppercase tracking-wide">Kosten</td>
                  </tr>
                  {[...expenseLines.entries()].map(([name, line]) => renderRow(name, line))}
                  {renderRow('Summe Kosten', expenseTotal, true)}

                  {/* Result section */}
                  <tr className="bg-blue-50">
                    <td colSpan={5} className="px-4 py-2 text-xs font-bold text-blue-800 uppercase tracking-wide">Ergebnis</td>
                  </tr>
                  <tr className="font-bold">
                    <td className="px-4 py-3 text-gray-900">Projektergebnis</td>
                    <td className={`px-4 py-3 text-right font-mono ${result.budget >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCHF(result.budget)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${result.actual >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCHF(result.actual)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${result.costToCome >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCHF(result.costToCome)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${result.forecast >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCHF(result.forecast)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {liqEvents.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">Keine Liquiditätsereignisse für die GuV-Berechnung vorhanden.</p>
            )}
          </div>
        )
      })()}

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
