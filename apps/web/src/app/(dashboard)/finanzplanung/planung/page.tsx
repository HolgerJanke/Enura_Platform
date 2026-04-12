export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { hasFinanzplanungPermission } from '@/lib/finanzplanung-guard'
import { PlanungTabs } from './planung-tabs'

export default async function PlanungPage() {
  const canPlan = await hasFinanzplanungPermission('module:finanzplanung:plan_cashout')
  if (!canPlan) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Keine Berechtigung für die Zahlungsplanung.</p>
        <Link href="/finanzplanung" className="text-blue-600 underline text-sm">Zurück</Link>
      </div>
    )
  }

  const session = await getSession()
  const supabase = createSupabaseServiceClient()

  // Fetch approved invoices + active payment runs in parallel
  const [invoicesRes, runsRes] = await Promise.all([
    supabase
      .from('invoices_incoming')
      .select('id, invoice_number, sender_name, gross_amount, currency, due_date')
      .eq('company_id', session!.companyId ?? '')
      .eq('status', 'approved')
      .order('due_date', { ascending: true }),
    supabase
      .from('payment_runs')
      .select('id, run_date, name, total_amount, item_count, currency, status')
      .eq('company_id', session!.companyId ?? '')
      .in('status', ['draft', 'submitted', 'under_review', 'approved'])
      .order('run_date', { ascending: true })
      .limit(20),
  ])

  const invoices = (invoicesRes.data ?? []) as Array<{
    id: string; invoice_number: string | null; sender_name: string | null
    gross_amount: number | null; currency: string; due_date: string | null
  }>

  const activeRuns = (runsRes.data ?? []) as Array<{
    id: string; run_date: string; name: string | null
    total_amount: number; item_count: number; currency: string; status: string
  }>

  const totalPending = invoices.reduce((sum, inv) => sum + Number(inv.gross_amount ?? 0), 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Zahlungsplanung</h1>
        <Link href="/finanzplanung" className="text-sm text-gray-500 hover:text-gray-700">
          ← Zurück
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Genehmigte Rechnungen terminieren und Zahlungsläufe erstellen.
      </p>

      {/* KPI cards — always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Genehmigte Rechnungen</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{invoices.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Gesamtbetrag ausstehend</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            CHF {totalPending.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Aktive Zahlungsläufe</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activeRuns.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <PlanungTabs invoices={invoices} activeRuns={activeRuns} />
    </div>
  )
}
