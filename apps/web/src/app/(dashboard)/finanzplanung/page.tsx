import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireFinanzplanung } from '@/lib/finanzplanung-guard'

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
  let pendingApprovals = 0
  let scheduledPayments = 0
  let overdueCount = 0

  if (session?.companyId) {
    const [invoicesRes, approvalsRes, scheduledRes, overdueRes] = await Promise.all([
      supabase
        .from('invoices_incoming')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', session.companyId)
        .in('status', ['received', 'extraction_done', 'match_review', 'in_validation']),
      supabase
        .from('invoices_incoming')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', session.companyId)
        .eq('status', 'pending_approval'),
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
    ])

    openInvoices = invoicesRes.count ?? 0
    pendingApprovals = approvalsRes.count ?? 0
    scheduledPayments = scheduledRes.count ?? 0
    overdueCount = overdueRes.count ?? 0
  }

  const cards = [
    {
      label: 'Offene Rechnungen',
      value: openInvoices,
      href: '/finanzplanung/eingang',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Ausstehende Genehmigungen',
      value: pendingApprovals,
      href: '/finanzplanung/eingang',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Geplante Zahlungen',
      value: scheduledPayments,
      href: '/finanzplanung/eingang',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Überfällig',
      value: overdueCount,
      href: '/finanzplanung/eingang',
      color: overdueCount > 0 ? 'text-red-600' : 'text-gray-400',
      bg: overdueCount > 0 ? 'bg-red-50' : 'bg-gray-50',
    },
  ]

  const hasValidate = session?.permissions.includes('module:finanzplanung:validate') || session?.isHoldingAdmin
  const hasPlanCashout = session?.permissions.includes('module:finanzplanung:plan_cashout') || session?.isHoldingAdmin
  const hasApprovePayment = session?.permissions.includes('module:finanzplanung:approve_payment') || session?.isHoldingAdmin
  const hasManageSuppliers = session?.permissions.includes('module:finanzplanung:manage_suppliers') || session?.isHoldingAdmin

  return (
    <div className="p-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Zurück zum Prozesshaus
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Finanzplanung</h1>
      <p className="text-sm text-gray-500 mb-8">
        Rechnungsverarbeitung, Validierung und Zahlungsplanung.
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`rounded-lg border border-gray-200 ${card.bg} p-5 hover:shadow-sm transition-shadow`}
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Schnellzugriff</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {hasValidate && (
          <Link
            href="/finanzplanung/eingang"
            className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Rechnungseingang</h3>
            </div>
            <p className="text-xs text-gray-500">Eingehende Rechnungen prüfen und validieren</p>
          </Link>
        )}

        <Link
          href="/finanzplanung/upload"
          className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Lieferanten</h3>
            </div>
            <p className="text-xs text-gray-500">Lieferanten-Stammdaten verwalten</p>
          </Link>
        )}

        {hasPlanCashout && (
          <Link
            href="/finanzplanung/planung"
            className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Zahlungsplanung</h3>
            </div>
            <p className="text-xs text-gray-500">Zahlungsausgaenge terminieren und optimieren</p>
          </Link>
        )}

        {hasApprovePayment && (
          <Link
            href="/finanzplanung/genehmigung"
            className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Genehmigungen</h3>
            </div>
            <p className="text-xs text-gray-500">Zahlungsläufe prüfen und freigeben</p>
          </Link>
        )}
      </div>
    </div>
  )
}
