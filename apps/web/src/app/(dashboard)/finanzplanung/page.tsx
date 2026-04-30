import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { requireFinanzplanung } from '@/lib/finanzplanung-guard'
import { ApprovalsKpiCard } from './finanzplanung-approvals-popup'

export const dynamic = 'force-dynamic'

export default async function FinanzplanungPage() {
  const hasAccess = await requireFinanzplanung()
  if (!hasAccess) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Das Finanzplanung-Modul ist nicht aktiviert oder Sie haben keine Berechtigung.</p>
        <Link href="/dashboard" className="text-blue-600 underline text-sm">Zum Dashboard</Link>
      </div>
    )
  }

  const session = await getSession()
  const supabase = createSupabaseServerClient()

  // Fetch summary stats
  let openInvoices = 0
  let scheduledPayments = 0
  let overdueCount = 0
  let pendingBankDataChanges = 0

  interface PendingRunData {
    id: string
    name: string | null
    run_date: string
    total_amount: number
    item_count: number
    currency: string
    status: string
    submitted_by: string | null
    submitted_at: string | null
  }
  interface RunItemData {
    id: string
    invoice_id: string
    creditor_name: string
    amount: number
    currency: string
    invoice_number: string | null
    invoice_status: string | null
    due_date: string | null
  }
  let pendingRuns: PendingRunData[] = []
  let runItemsMap: Record<string, RunItemData[]> = {}
  let submitterNames: Record<string, string> = {}
  let approverNames: string[] = []

  if (session?.companyId) {
    const serviceDb = createSupabaseServiceClient()

    const [invoicesRes, scheduledRes, overdueRes, pendingRunsRes] = await Promise.all([
      supabase
        .from('invoices_incoming')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', session.companyId)
        .in('status', ['received', 'extraction_done', 'match_review', 'in_validation']),
      supabase
        .from('invoices_incoming')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', session.companyId)
        .eq('status', 'scheduled'),
      supabase
        .from('invoices_incoming')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', session.companyId)
        .in('status', ['approved', 'scheduled'])
        .lt('due_date', new Date().toISOString().split('T')[0]!),
      serviceDb
        .from('payment_runs')
        .select('id, name, run_date, total_amount, item_count, currency, status, submitted_by, submitted_at')
        .eq('company_id', session.companyId)
        .in('status', ['submitted', 'under_review'])
        .order('submitted_at', { ascending: false }),
    ])

    openInvoices = invoicesRes.count ?? 0
    scheduledPayments = scheduledRes.count ?? 0
    overdueCount = overdueRes.count ?? 0
    pendingRuns = (pendingRunsRes.data ?? []) as PendingRunData[]

    // Fetch payment run items with invoice details
    const runIds = pendingRuns.map(r => r.id)
    if (runIds.length > 0) {
      const { data: itemsData } = await serviceDb
        .from('payment_run_items')
        .select('id, run_id, invoice_id, creditor_name, amount, currency')
        .in('run_id', runIds)
        .order('sort_order')

      // Fetch invoice details for items
      const invoiceIds = [...new Set((itemsData ?? []).map((i: Record<string, unknown>) => i['invoice_id'] as string))]
      let invoiceMap: Record<string, { number: string | null; status: string | null; due_date: string | null }> = {}
      if (invoiceIds.length > 0) {
        const { data: invoices } = await serviceDb
          .from('invoices_incoming')
          .select('id, invoice_number, status, due_date')
          .in('id', invoiceIds)
        for (const inv of (invoices ?? []) as Array<Record<string, unknown>>) {
          invoiceMap[inv['id'] as string] = {
            number: inv['invoice_number'] as string | null,
            status: inv['status'] as string | null,
            due_date: inv['due_date'] as string | null,
          }
        }
      }

      // Group items by run_id
      for (const item of (itemsData ?? []) as Array<Record<string, unknown>>) {
        const rid = item['run_id'] as string
        const invId = item['invoice_id'] as string
        const inv = invoiceMap[invId]
        const arr = runItemsMap[rid] ?? []
        arr.push({
          id: item['id'] as string,
          invoice_id: invId,
          creditor_name: item['creditor_name'] as string,
          amount: Number(item['amount'] ?? 0),
          currency: item['currency'] as string,
          invoice_number: inv?.number ?? null,
          invoice_status: inv?.status ?? null,
          due_date: inv?.due_date ?? null,
        })
        runItemsMap[rid] = arr
      }
    }

    // Fetch submitter names
    const submitterIds = [...new Set(pendingRuns.map(r => r.submitted_by).filter(Boolean))] as string[]
    if (submitterIds.length > 0) {
      const { data: profiles } = await serviceDb
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', submitterIds)
      for (const p of (profiles ?? []) as Array<Record<string, unknown>>) {
        submitterNames[p['id'] as string] = `${p['first_name'] ?? ''} ${p['last_name'] ?? ''}`.trim()
      }
    }

    // Fetch users who can approve payment runs (via role permissions)
    const { data: approverRoles } = await serviceDb
      .from('role_permissions')
      .select('role_id, permissions!inner(key)')
      .eq('permissions.key', 'module:finanzplanung:approve_payment')

    const roleIds = (approverRoles ?? []).map((r: Record<string, unknown>) => r['role_id'] as string)
    if (roleIds.length > 0) {
      const { data: profileRoles } = await serviceDb
        .from('profile_roles')
        .select('profile_id')
        .in('role_id', roleIds)

      const approverIds = [...new Set((profileRoles ?? []).map((pr: Record<string, unknown>) => pr['profile_id'] as string))]
      if (approverIds.length > 0) {
        const { data: approverProfiles } = await serviceDb
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', approverIds)
          .eq('company_id', session.companyId)
          .eq('is_active', true)
        approverNames = (approverProfiles ?? []).map((p: Record<string, unknown>) =>
          `${p['first_name'] ?? ''} ${p['last_name'] ?? ''}`.trim()
        ).filter(Boolean)
      }
    }

    const bankDataRes = await supabase
      .from('supplier_bank_change_requests')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', session.companyId)
      .in('status', ['pending_review', 'reviewed'])

    pendingBankDataChanges = bankDataRes.count ?? 0
  }

  const hasManageSuppliers = session?.permissions.includes('module:finanzplanung:manage_suppliers') || session?.isHoldingAdmin
  const hasBankDataReview = session?.permissions.includes('module:finanzplanung:review_bank_data') || session?.permissions.includes('module:finanzplanung:approve_bank_data') || session?.isHoldingAdmin

  const chevron = (
    <svg className="h-5 w-5 text-gray-300 shrink-0 hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )

  return (
    <div className="p-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Zurück zum Prozesshaus
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Finanzplanung</h1>
      <p className="text-sm text-gray-500 mb-6">
        Rechnungsverarbeitung, Validierung und Zahlungsplanung.
      </p>

      {/* Workflow pipeline */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Workflow</p>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Step 1: Eingang */}
          <Link
            href="/finanzplanung/eingang"
            className="flex-1 rounded-lg border border-gray-200 bg-blue-50 p-5 hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-4.5 w-4.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900">Eingang</p>
            </div>
            <p className="text-3xl font-bold text-blue-600">{openInvoices}</p>
            <p className="text-xs text-gray-500 mt-1">offene Rechnungen</p>
          </Link>

          {chevron}

          {/* Step 2: Genehmigungen (popup) */}
          <div className="flex-1">
            <ApprovalsKpiCard
              count={pendingRuns.length}
              pendingRuns={pendingRuns}
              runItems={runItemsMap}
              submitters={submitterNames}
              approvers={approverNames}
            />
          </div>

          {chevron}

          {/* Step 3: Zahlungen */}
          <Link
            href="/finanzplanung/planung"
            className="flex-1 rounded-lg border border-gray-200 bg-green-50 p-5 hover:shadow-md hover:border-green-300 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                <svg className="h-4.5 w-4.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900">Zahlungen</p>
            </div>
            <p className="text-3xl font-bold text-green-600">{scheduledPayments}</p>
            <p className="text-xs text-gray-500 mt-1">geplante Zahlungen</p>
          </Link>

          {chevron}

          {/* Step 4: Überfällig */}
          <Link
            href="/finanzplanung/eingang"
            className={`flex-1 rounded-lg border p-5 hover:shadow-md transition-all ${
              overdueCount > 0
                ? 'border-red-200 bg-red-50 hover:border-red-300'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${overdueCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <svg className={`h-4.5 w-4.5 ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900">Überfällig</p>
            </div>
            <p className={`text-3xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{overdueCount}</p>
            <p className="text-xs text-gray-500 mt-1">überfällige Rechnungen</p>
          </Link>
        </div>
      </div>

      {/* Overdue warning banner */}
      {overdueCount > 0 && (
        <Link
          href="/finanzplanung/eingang"
          className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-5 py-3 mb-8 hover:bg-red-100 transition-colors"
        >
          <svg className="h-5 w-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm font-medium text-red-800">
            {overdueCount} überfällige Rechnungen — Bitte prüfen
          </p>
        </Link>
      )}

      {/* Secondary actions */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Aktionen</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/finanzplanung/upload"
          className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
              <svg className="h-4.5 w-4.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Rechnung hochladen</h3>
          </div>
          <p className="text-xs text-gray-500">PDF oder Bild manuell hochladen</p>
        </Link>

        {hasManageSuppliers && (
          <Link
            href="/finanzplanung/lieferanten"
            className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-4.5 w-4.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Lieferanten</h3>
            </div>
            <p className="text-xs text-gray-500">Lieferanten-Stammdaten verwalten</p>
          </Link>
        )}

        {hasBankDataReview && (
          <Link
            href="/finanzplanung/bankdaten-genehmigung"
            className={`rounded-lg border p-5 hover:shadow-sm transition-shadow ${
              pendingBankDataChanges > 0
                ? 'border-yellow-300 bg-yellow-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-100">
                <svg className="h-4.5 w-4.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Bankdaten-Genehmigung</h3>
              {pendingBankDataChanges > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-yellow-500 px-1.5 text-xs font-bold text-white">
                  {pendingBankDataChanges}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">Lieferanten-Bankdaten pruefen und genehmigen (4-Augen-Prinzip)</p>
          </Link>
        )}
      </div>
    </div>
  )
}
