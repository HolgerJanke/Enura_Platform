export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { FinanceAIChat } from './finance-ai-chat'

export default async function ControllingLandingPage() {
  const session = await getSession()
  if (!session?.companyId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Nicht angemeldet.</p>
      </div>
    )
  }

  const db = getDataAccess()
  const serviceDb = createSupabaseServiceClient()
  const cid = session.companyId

  // Fetch summary data for the AI context
  const [
    wonCount,
    sentCount,
    draftCount,
    lostCount,
    pipelineTotal,
    incomingInvoicesRes,
    bexioInvoicesRes,
    bexioPaymentsRes,
  ] = await Promise.all([
    db.offers.count(cid, { status: 'won' }),
    db.offers.count(cid, { status: 'sent' }),
    db.offers.count(cid, { status: 'draft' }),
    db.offers.count(cid, { status: 'lost' }),
    db.offers.sumAmountChf(cid, { excludeStatus: ['lost', 'expired'] }),
    serviceDb
      .from('invoices_incoming')
      .select('id, gross_amount, status, due_date')
      .eq('company_id', cid),
    // Bexio outgoing invoices
    serviceDb
      .from('invoices')
      .select('id, total_chf, status, due_at')
      .eq('company_id', cid),
    // Bexio payments
    serviceDb
      .from('payments')
      .select('id, amount_chf')
      .eq('company_id', cid),
  ])

  // Incoming invoices (supplier bills)
  const incomingInvoices = (incomingInvoicesRes.data ?? []) as Array<Record<string, unknown>>
  const incomingOpen = incomingInvoices.filter(
    (i) => !['paid', 'returned_formal', 'returned_sender'].includes(i['status'] as string),
  )
  const incomingOverdue = incomingOpen.filter((i) => {
    const due = i['due_date'] as string | null
    return due && new Date(due) < new Date()
  })

  // Bexio outgoing invoices (customer invoices)
  const bexioInvoices = (bexioInvoicesRes.data ?? []) as Array<Record<string, unknown>>
  const bexioPayments = (bexioPaymentsRes.data ?? []) as Array<Record<string, unknown>>
  const bexioOpen = bexioInvoices.filter(i => ['sent', 'overdue', 'partially_paid'].includes(i['status'] as string))
  const bexioOverdue = bexioInvoices.filter(i => {
    if (i['status'] === 'overdue') return true
    const due = i['due_at'] as string | null
    return due && new Date(due) < new Date() && ['sent', 'partially_paid'].includes(i['status'] as string)
  })
  const bexioPaid = bexioInvoices.filter(i => i['status'] === 'paid')

  // Combined receivables: use Bexio data if available, else incoming
  const openReceivables = bexioOpen.length > 0
    ? bexioOpen.reduce((s, i) => s + Number(i['total_chf'] ?? 0), 0)
    : incomingOpen.reduce((s, i) => s + Number(i['gross_amount'] ?? 0), 0)
  const overdueAmount = bexioOverdue.length > 0
    ? bexioOverdue.reduce((s, i) => s + Number(i['total_chf'] ?? 0), 0)
    : incomingOverdue.reduce((s, i) => s + Number(i['gross_amount'] ?? 0), 0)
  const overdueCount = bexioOverdue.length > 0 ? bexioOverdue.length : incomingOverdue.length
  const openInvoicesCount = bexioOpen.length > 0 ? bexioOpen.length : incomingOpen.length
  const totalInvoicesCount = bexioInvoices.length > 0 ? bexioInvoices.length : incomingInvoices.length
  const totalRevenue = bexioPaid.reduce((s, i) => s + Number(i['total_chf'] ?? 0), 0)
  const totalPaymentsReceived = bexioPayments.reduce((s, i) => s + Number(i['amount_chf'] ?? 0), 0)

  // Prepare context summary for AI
  const aiContext = {
    pipeline_value: pipelineTotal,
    offers_won: wonCount,
    offers_sent: sentCount,
    offers_draft: draftCount,
    offers_lost: lostCount,
    open_receivables: openReceivables,
    overdue_amount: overdueAmount,
    overdue_count: overdueCount,
    open_invoices_count: openInvoicesCount,
    total_invoices: totalInvoicesCount,
    total_revenue_paid: totalRevenue,
    total_payments_received: totalPaymentsReceived,
    bexio_invoices_count: bexioInvoices.length,
    bexio_payments_count: bexioPayments.length,
  }

  const tools = [
    {
      label: 'Rechnungsverarbeitung',
      href: '/finanzplanung',
      description: 'Eingangsrechnungen, Lieferanten, Genehmigungen und Zahlungslaeufe',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      color: 'bg-orange-100 text-orange-600',
    },
    {
      label: 'Finanzen & Cashflow',
      href: '/finance',
      description: 'Rechnungen, offene Forderungen, monatlicher Umsatz und Cashflow-Diagramm',
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Liquiditaetsplanung',
      href: '/liquidity',
      description: 'Budget, Plan und Ist-Werte, 30/60/90-Tage Liquiditaetsprognose',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Kundenvertraege & Kalkulation',
      href: '/finanzplanung/vertraege',
      description: 'Auftraege, Zahlungsplaene, Einkauf und Projektkalkulation',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'bg-indigo-100 text-indigo-600',
    },
  ]

  return (
    <div className="p-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Zurück zum Prozesshaus
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Finanzen & Controlling</h1>
      <p className="text-sm text-gray-500 mb-6">
        Finanzübersicht, Liquiditätsplanung und KI-gestützte Analyse.
      </p>

      {/* Quick KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Pipeline-Wert</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {pipelineTotal > 1_000_000
              ? `CHF ${(pipelineTotal / 1_000_000).toFixed(1)}M`
              : `CHF ${Math.round(pipelineTotal).toLocaleString('de-CH')}`}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Offene Forderungen</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            CHF {Math.round(openReceivables).toLocaleString('de-CH')}
          </p>
          <p className="text-[11px] text-gray-400">{openInvoicesCount} Rechnungen</p>
        </div>
        <div className={`rounded-lg border p-4 ${overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-xs ${overdueCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>Überfällig</p>
          <p className={`text-lg font-bold mt-1 ${overdueCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            CHF {Math.round(overdueAmount).toLocaleString('de-CH')}
          </p>
          <p className={`text-[11px] ${overdueCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>{overdueCount} Rechnungen</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Abschlüsse</p>
          <p className="text-lg font-bold text-green-700 mt-1">{wonCount}</p>
          <p className="text-[11px] text-gray-400">von {wonCount + sentCount + draftCount + lostCount} Angeboten</p>
        </div>
      </div>

      {/* Tool cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tool.color}`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tool.icon} />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{tool.label}</h3>
            </div>
            <p className="text-xs text-gray-500">{tool.description}</p>
          </Link>
        ))}
      </div>

      {/* AI Assistant */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
            <svg className="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">KI-Finanzassistent</h2>
            <p className="text-[11px] text-gray-500">Stellen Sie Fragen zu Ihren Finanzdaten</p>
          </div>
        </div>
        <FinanceAIChat context={aiContext} />
      </div>
    </div>
  )
}
