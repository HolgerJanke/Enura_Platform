export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { FinanceCashflowChart } from './finance-chart'

export default async function FinancePage() {
  const session = await getSession()
  if (!session?.companyId) return null

  const db = createSupabaseServiceClient()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]!

  // Fetch from BOTH invoice tables + payments + liquidity events
  const [
    bexioInvoicesRes,
    bexioPaymentsRes,
    incomingInvoicesRes,
    liqEventsRes,
    currencyRes,
  ] = await Promise.all([
    // Bexio outgoing invoices (synced to 'invoices' table)
    db.from('invoices')
      .select('id, invoice_number, customer_name, amount_chf, tax_chf, total_chf, status, issued_at, due_at, paid_at')
      .eq('company_id', session.companyId)
      .order('issued_at', { ascending: false }),
    // Bexio payments
    db.from('payments')
      .select('id, invoice_id, amount_chf, payment_date, reference, notes')
      .eq('company_id', session.companyId)
      .order('payment_date', { ascending: false }),
    // Incoming invoices (manual upload / OCR)
    db.from('invoices_incoming')
      .select('id, gross_amount, currency, status, due_date')
      .eq('company_id', session.companyId),
    // Liquidity events
    db.from('liquidity_event_instances')
      .select('id, direction, budget_amount, budget_date, scheduled_amount, scheduled_date, actual_amount, actual_date, marker_type')
      .eq('company_id', session.companyId)
      .eq('marker_type', 'event')
      .order('budget_date')
      .range(0, 4999),
    db.from('company_currency_settings')
      .select('base_currency')
      .eq('company_id', session.companyId)
      .single(),
  ])

  const bexioInvoices = (bexioInvoicesRes.data ?? []) as Array<Record<string, unknown>>
  const bexioPayments = (bexioPaymentsRes.data ?? []) as Array<Record<string, unknown>>
  const incomingInvoices = (incomingInvoicesRes.data ?? []) as Array<Record<string, unknown>>
  const liqEvents = (liqEventsRes.data ?? []) as Array<Record<string, unknown>>
  const currency = (currencyRes.data as Record<string, unknown> | null)?.['base_currency'] as string ?? 'CHF'

  // --- Bexio outgoing invoice KPIs ---
  const bexioPaid = bexioInvoices.filter(i => i['status'] === 'paid')
  const bexioOpen = bexioInvoices.filter(i => ['sent', 'overdue', 'partially_paid'].includes(i['status'] as string))
  const bexioOverdue = bexioInvoices.filter(i => {
    if (i['status'] === 'overdue') return true
    const due = i['due_at'] as string | null
    return due && new Date(due) < today && ['sent', 'partially_paid'].includes(i['status'] as string)
  })
  const bexioDraft = bexioInvoices.filter(i => i['status'] === 'draft')

  const totalInvoiced = bexioInvoices.reduce((s, i) => s + Number(i['total_chf'] ?? 0), 0)
  const totalPaid = bexioPaid.reduce((s, i) => s + Number(i['total_chf'] ?? 0), 0)
  const totalOpen = bexioOpen.reduce((s, i) => s + Number(i['total_chf'] ?? 0), 0)
  const totalOverdue = bexioOverdue.reduce((s, i) => s + Number(i['total_chf'] ?? 0), 0)
  const totalPayments = bexioPayments.reduce((s, i) => s + Number(i['amount_chf'] ?? 0), 0)

  // --- Incoming invoice KPIs (for comparison) ---
  const incomingOpen = incomingInvoices.filter(i => !['paid', 'returned_formal', 'returned_sender'].includes(i['status'] as string))
  const incomingOverdue = incomingOpen.filter(i => {
    const due = i['due_date'] as string | null
    return due && new Date(due) < today
  })
  const incomingOpenAmount = incomingOpen.reduce((s, i) => s + Number(i['gross_amount'] ?? 0), 0)

  // --- Liquidity forecast ---
  function forecastDays(days: number): number {
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() + days)
    let cumulative = 0
    for (const evt of liqEvents) {
      const d = (evt['actual_date'] ?? evt['scheduled_date'] ?? evt['budget_date']) as string | null
      if (!d) continue
      const evtDate = new Date(d)
      if (evtDate > cutoff) break
      const amt = Number(evt['actual_amount'] ?? evt['scheduled_amount'] ?? evt['budget_amount'] ?? 0)
      cumulative += (evt['direction'] === 'income' ? amt : -amt)
    }
    return cumulative
  }

  const forecast30 = forecastDays(30)
  const forecast60 = forecastDays(60)
  const forecast90 = forecastDays(90)

  // Chart: build from Bexio payments (income) grouped by month
  // Also include liquidity events if present
  const chartEvents = liqEvents.map(evt => ({
    date: ((evt['actual_date'] ?? evt['scheduled_date'] ?? evt['budget_date']) as string) ?? '',
    amount: Number(evt['actual_amount'] ?? evt['scheduled_amount'] ?? evt['budget_amount'] ?? 0),
    direction: evt['direction'] as string,
  })).filter(e => e.date)

  // If no liquidity events but we have Bexio data, build chart from invoices
  if (chartEvents.length === 0 && bexioInvoices.length > 0) {
    for (const inv of bexioInvoices) {
      const date = (inv['issued_at'] as string) ?? ''
      const amount = Number(inv['total_chf'] ?? 0)
      if (date && amount > 0) {
        chartEvents.push({ date, amount, direction: 'income' })
      }
    }
    // Add payments as expense events (money received reduces receivables)
    for (const p of bexioPayments) {
      const date = (p['payment_date'] as string) ?? ''
      const amount = Number(p['amount_chf'] ?? 0)
      if (date && amount > 0) {
        chartEvents.push({ date, amount, direction: 'income' })
      }
    }
  }

  // Recent invoices for the table (top 15)
  const recentInvoices = bexioInvoices.slice(0, 15)

  function fmtCHF(n: number): string {
    return `${currency} ${n.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const statusLabel: Record<string, { label: string; color: string }> = {
    draft: { label: 'Entwurf', color: 'bg-gray-100 text-gray-600' },
    sent: { label: 'Versendet', color: 'bg-blue-50 text-blue-700' },
    paid: { label: 'Bezahlt', color: 'bg-green-50 text-green-700' },
    overdue: { label: 'Überfällig', color: 'bg-red-50 text-red-700' },
    cancelled: { label: 'Storniert', color: 'bg-gray-100 text-gray-500' },
    partially_paid: { label: 'Teilbezahlt', color: 'bg-yellow-50 text-yellow-700' },
  }

  return (
    <div className="p-4 sm:p-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Zurück zum Prozesshaus
      </Link>
      <h1 className="text-xl sm:text-2xl font-semibold text-brand-text-primary mb-2">
        Finanzen &amp; Cashflow
      </h1>
      <p className="text-brand-text-secondary mb-6">{today.toLocaleDateString('de-CH')}</p>

      {/* Primary KPI cards — Bexio outgoing invoices */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-xs text-brand-text-secondary">Gesamtvolumen</p>
          <p className="text-xl font-bold text-brand-text-primary mt-1">{fmtCHF(totalInvoiced)}</p>
          <p className="text-xs text-brand-text-secondary mt-0.5">{bexioInvoices.length} Rechnungen (Bexio)</p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-xs text-brand-text-secondary">Bezahlt</p>
          <p className="text-xl font-bold text-green-700 mt-1">{fmtCHF(totalPaid)}</p>
          <p className="text-xs text-brand-text-secondary mt-0.5">{bexioPaid.length} Rechnungen</p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-xs text-brand-text-secondary">Offene Forderungen</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{fmtCHF(totalOpen)}</p>
          <p className="text-xs text-brand-text-secondary mt-0.5">{bexioOpen.length} Rechnungen</p>
        </div>
        <div className={`rounded-brand p-4 border ${bexioOverdue.length > 0 ? 'bg-red-50 border-red-200' : 'bg-brand-surface border-gray-200'}`}>
          <p className={`text-xs ${bexioOverdue.length > 0 ? 'text-red-600' : 'text-brand-text-secondary'}`}>Überfällig</p>
          <p className={`text-xl font-bold mt-1 ${bexioOverdue.length > 0 ? 'text-red-700' : 'text-brand-text-primary'}`}>{fmtCHF(totalOverdue)}</p>
          <p className={`text-xs mt-0.5 ${bexioOverdue.length > 0 ? 'text-red-500' : 'text-brand-text-secondary'}`}>{bexioOverdue.length} Rechnungen</p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-xs text-brand-text-secondary">Zahlungseingänge</p>
          <p className="text-xl font-bold text-brand-text-primary mt-1">{fmtCHF(totalPayments)}</p>
          <p className="text-xs text-brand-text-secondary mt-0.5">{bexioPayments.length} Zahlungen</p>
        </div>
      </div>

      {/* Status breakdown — compact */}
      <div className="bg-brand-surface rounded-brand p-4 border border-gray-200 mb-6">
        <div className="flex items-center gap-6 flex-wrap">
          <h2 className="text-sm font-semibold text-brand-text-primary">Rechnungsstatus</h2>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            {(['draft', 'sent', 'paid', 'overdue', 'partially_paid', 'cancelled'] as const).map(status => {
              const count = bexioInvoices.filter(i => i['status'] === status).length
              if (count === 0) return null
              const info = statusLabel[status]!
              return (
                <span key={status} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${info.color}`}>
                  {info.label}: {count}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Incoming invoices info (if any exist) */}
      {incomingInvoices.length > 0 && (
        <div className="bg-purple-50 rounded-brand p-4 border border-purple-200 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-purple-900">Eingangsrechnungen</h2>
              <p className="text-xs text-purple-700 mt-0.5">{incomingInvoices.length} Rechnungen · {incomingOpen.length} offen · {fmtCHF(incomingOpenAmount)}</p>
            </div>
            <Link href="/finanzplanung/eingang" className="text-xs font-medium text-purple-700 hover:underline">
              Zur Rechnungsverarbeitung →
            </Link>
          </div>
        </div>
      )}

      {/* Liquidity forecast */}
      {liqEvents.length > 0 && (
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200 mb-6">
          <div className="flex items-center gap-6 flex-wrap">
            <h2 className="text-sm font-semibold text-brand-text-primary">Liquiditätsprognose</h2>
            <div className="flex items-center gap-6 text-sm">
              <span className="text-brand-text-secondary">
                30 Tage: <span className={`font-bold ${forecast30 >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCHF(forecast30)}</span>
              </span>
              <span className="text-brand-text-secondary">
                60 Tage: <span className={`font-bold ${forecast60 >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCHF(forecast60)}</span>
              </span>
              <span className="text-brand-text-secondary">
                90 Tage: <span className={`font-bold ${forecast90 >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtCHF(forecast90)}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Overdue warning */}
      {bexioOverdue.length > 0 && (
        <div className="rounded-brand bg-red-50 border border-red-200 p-4 mb-6">
          <p className="text-sm font-medium text-red-800">Zahlungswarnung</p>
          <p className="text-sm text-red-700 mt-1">
            {bexioOverdue.length} Rechnungen im Wert von {fmtCHF(totalOverdue)} sind überfällig. Bitte mahnen Sie offene Posten zeitnah an.
          </p>
        </div>
      )}

      {/* Recent invoices table — Bexio data */}
      {recentInvoices.length > 0 && (
        <div className="bg-brand-surface rounded-brand border border-gray-200 mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-brand-text-primary">Rechnungen (Bexio)</h2>
            <span className="text-xs text-brand-text-secondary">{bexioInvoices.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-5 py-2.5 font-medium">Nr.</th>
                  <th className="px-5 py-2.5 font-medium">Kunde</th>
                  <th className="px-5 py-2.5 font-medium text-right">Netto</th>
                  <th className="px-5 py-2.5 font-medium text-right">MwSt.</th>
                  <th className="px-5 py-2.5 font-medium text-right">Brutto</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Datum</th>
                  <th className="px-5 py-2.5 font-medium">Fällig</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => {
                  const status = inv['status'] as string
                  const info = statusLabel[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' }
                  const issuedAt = inv['issued_at'] as string | null
                  const dueAt = inv['due_at'] as string | null
                  const isOverdue = dueAt && new Date(dueAt) < today && !['paid', 'cancelled'].includes(status)
                  return (
                    <tr key={inv['id'] as string} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-700">{inv['invoice_number'] as string}</td>
                      <td className="px-5 py-2.5 text-brand-text-primary max-w-[200px] truncate">{inv['customer_name'] as string}</td>
                      <td className="px-5 py-2.5 text-right font-mono">{fmtCHF(Number(inv['amount_chf'] ?? 0))}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-gray-500">{fmtCHF(Number(inv['tax_chf'] ?? 0))}</td>
                      <td className="px-5 py-2.5 text-right font-mono font-medium">{fmtCHF(Number(inv['total_chf'] ?? 0))}</td>
                      <td className="px-5 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${info.color}`}>{info.label}</span>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-gray-500">{issuedAt ? new Date(issuedAt).toLocaleDateString('de-CH') : '–'}</td>
                      <td className={`px-5 py-2.5 text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {dueAt ? new Date(dueAt).toLocaleDateString('de-CH') : '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {bexioInvoices.length > 15 && (
            <div className="px-5 py-3 border-t border-gray-100 text-center">
              <span className="text-xs text-brand-text-secondary">Zeigt 15 von {bexioInvoices.length} Rechnungen</span>
            </div>
          )}
        </div>
      )}

      {/* Cashflow chart */}
      {chartEvents.length > 0 && (
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-brand-text-primary mb-4">Cashflow-Diagramm</h2>
          <FinanceCashflowChart events={chartEvents} currency={currency} />
        </div>
      )}

      {/* Empty state */}
      {bexioInvoices.length === 0 && incomingInvoices.length === 0 && (
        <div className="rounded-brand bg-gray-50 border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500 mb-2">Keine Finanzdaten vorhanden.</p>
          <p className="text-xs text-gray-400">Verbinden Sie Bexio unter Einstellungen → Integrationen, um Rechnungen und Zahlungen zu synchronisieren.</p>
          <Link href="/settings/connectors/bexio" className="inline-block mt-3 text-xs font-medium text-blue-600 hover:underline">
            Bexio verbinden →
          </Link>
        </div>
      )}
    </div>
  )
}
