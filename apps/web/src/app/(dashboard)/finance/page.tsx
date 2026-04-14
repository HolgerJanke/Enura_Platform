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

  // Fetch real data in parallel
  const [invoicesRes, liqEventsRes, currencyRes] = await Promise.all([
    db.from('invoices_incoming')
      .select('id, gross_amount, currency, status, due_date')
      .eq('company_id', session.companyId),
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

  const invoices = (invoicesRes.data ?? []) as Array<Record<string, unknown>>
  const liqEvents = (liqEventsRes.data ?? []) as Array<Record<string, unknown>>
  const currency = (currencyRes.data as Record<string, unknown> | null)?.['base_currency'] as string ?? 'CHF'

  // Calculate KPIs from real data
  const paidInvoices = invoices.filter(i => i['status'] === 'paid')
  const openInvoices = invoices.filter(i => !['paid', 'returned_formal', 'returned_sender'].includes(i['status'] as string))
  const overdueInvoices = openInvoices.filter(i => {
    const due = i['due_date'] as string | null
    return due && new Date(due) < today
  })

  const totalRevenue = paidInvoices.reduce((s, i) => s + Number(i['gross_amount'] ?? 0), 0)
  const openReceivables = openInvoices.reduce((s, i) => s + Number(i['gross_amount'] ?? 0), 0)
  const overdueAmount = overdueInvoices.reduce((s, i) => s + Number(i['gross_amount'] ?? 0), 0)
  const paymentsReceived = paidInvoices.reduce((s, i) => s + Number(i['gross_amount'] ?? 0), 0)

  // Liquidity forecast from liquidity_event_instances
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

  // Prepare chart data: monthly income vs expense
  const chartEvents = liqEvents.map(evt => ({
    date: ((evt['actual_date'] ?? evt['scheduled_date'] ?? evt['budget_date']) as string) ?? '',
    amount: Number(evt['actual_amount'] ?? evt['scheduled_amount'] ?? evt['budget_amount'] ?? 0),
    direction: evt['direction'] as string,
  })).filter(e => e.date)

  function fmtCHF(n: number): string {
    return `${currency} ${n.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-xs text-brand-text-secondary">Erhaltene Zahlungen</p>
          <p className="text-xl font-bold text-brand-text-primary mt-1">{fmtCHF(paymentsReceived)}</p>
          <p className="text-xs text-brand-text-secondary mt-0.5">{paidInvoices.length} Rechnungen</p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-xs text-brand-text-secondary">Offene Forderungen</p>
          <p className="text-xl font-bold text-brand-text-primary mt-1">{fmtCHF(openReceivables)}</p>
          <p className="text-xs text-brand-text-secondary mt-0.5">{openInvoices.length} Rechnungen</p>
        </div>
        <div className={`rounded-brand p-4 border ${overdueInvoices.length > 0 ? 'bg-red-50 border-red-200' : 'bg-brand-surface border-gray-200'}`}>
          <p className={`text-xs ${overdueInvoices.length > 0 ? 'text-red-600' : 'text-brand-text-secondary'}`}>Überfällig</p>
          <p className={`text-xl font-bold mt-1 ${overdueInvoices.length > 0 ? 'text-red-700' : 'text-brand-text-primary'}`}>{fmtCHF(overdueAmount)}</p>
          <p className={`text-xs mt-0.5 ${overdueInvoices.length > 0 ? 'text-red-500' : 'text-brand-text-secondary'}`}>{overdueInvoices.length} Rechnungen</p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-xs text-brand-text-secondary">Gesamtumsatz</p>
          <p className="text-xl font-bold text-brand-text-primary mt-1">{fmtCHF(totalRevenue)}</p>
        </div>
      </div>

      {/* Liquidity forecast — single row */}
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

      {/* Liquidity warning */}
      {forecast30 < 0 && (
        <div className="rounded-brand bg-red-50 border border-red-200 p-4 mb-6">
          <p className="text-sm font-medium text-red-800">Liquiditätswarnung</p>
          <p className="text-sm text-red-700 mt-1">
            Die 30-Tage-Liquiditätsprognose ist negativ ({fmtCHF(forecast30)}). Bitte prüfen Sie offene Forderungen und geplante Ausgaben.
          </p>
        </div>
      )}

      {/* Cashflow chart */}
      <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-brand-text-primary mb-4">Cashflow-Diagramm</h2>
        <FinanceCashflowChart events={chartEvents} currency={currency} />
      </div>
    </div>
  )
}
