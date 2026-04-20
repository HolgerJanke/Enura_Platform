export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireFinanzplanung } from '@/lib/finanzplanung-guard'
import { PaymentRunClient } from './payment-run-client'

interface RunRow {
  id: string
  run_date: string
  name: string | null
  total_amount: number
  item_count: number
  currency: string
  status: string
  created_at: string
  submitted_at: string | null
  approved_at: string | null
  rejection_reason: string | null
  planner_reviewed_all: boolean
  approver_reviewed_all: boolean
}

interface RunItemRow {
  id: string
  invoice_id: string
  creditor_name: string
  creditor_iban: string
  amount: number
  currency: string
  payment_reference: string | null
  reviewed_by_planner: boolean
  reviewed_by_approver: boolean
  sort_order: number
}

export default async function PaymentRunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const hasAccess = await requireFinanzplanung()
  if (!hasAccess) {
    return <div className="p-8 text-center"><p className="text-gray-500">Kein Zugriff.</p></div>
  }

  const session = await getSession()
  const supabase = createSupabaseServerClient()

  const { data: run } = await supabase
    .from('payment_runs')
    .select('*')
    .eq('id', runId)
    .eq('company_id', session!.companyId ?? '')
    .single()

  if (!run) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Zahlungslauf nicht gefunden.</p>
        <Link href="/finanzplanung/planung" className="text-blue-600 underline text-sm">Zurück</Link>
      </div>
    )
  }

  const r = run as unknown as RunRow

  const { data: items } = await supabase
    .from('payment_run_items')
    .select('id, invoice_id, creditor_name, creditor_iban, amount, currency, payment_reference, reviewed_by_planner, reviewed_by_approver, sort_order')
    .eq('run_id', runId)
    .order('sort_order')

  const runItems = (items ?? []) as RunItemRow[]

  const canPlan = session!.isHoldingAdmin || session!.permissions.includes('module:finanzplanung:plan_cashout')
  const canApprove = session!.isHoldingAdmin || session!.permissions.includes('module:finanzplanung:approve_payment')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/finanzplanung/planung" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">
            ← Zurück zur Planung
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">
            {r.name ?? `Zahlungslauf ${r.run_date}`}
          </h1>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
          r.status === 'approved' ? 'bg-green-100 text-green-700' :
          r.status === 'rejected' ? 'bg-red-100 text-red-700' :
          r.status === 'exported' ? 'bg-blue-100 text-blue-700' :
          'bg-amber-100 text-amber-700'
        }`}>
          {r.status}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Zahlungsdatum</p>
          <p className="text-lg font-bold text-gray-900">{new Date(r.run_date).toLocaleDateString('de-CH')}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Gesamtbetrag</p>
          <p className="text-lg font-bold text-gray-900">
            {r.currency} {Number(r.total_amount).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Positionen</p>
          <p className="text-lg font-bold text-gray-900">{r.item_count}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Erstellt</p>
          <p className="text-lg font-bold text-gray-900">{new Date(r.created_at).toLocaleDateString('de-CH')}</p>
        </div>
      </div>

      {r.rejection_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-sm font-semibold text-red-800 mb-1">Ablehnungsgrund</p>
          <p className="text-sm text-red-700">{r.rejection_reason}</p>
        </div>
      )}

      {/* Items table + action buttons */}
      <PaymentRunClient
        runId={r.id}
        status={r.status}
        items={runItems}
        canPlan={canPlan}
        canApprove={canApprove}
      />
    </div>
  )
}
