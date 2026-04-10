import Link from 'next/link'
import { requireHoldingAdmin } from '@/lib/permissions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatCHF, formatDate } from '@enura/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyLiquidity {
  id: string
  name: string
  slug: string
  netCashflow: number
  overdueCount: number
  totalPlanIncome: number
  totalPlanExpense: number
  totalActualIncome: number
  totalActualExpense: number
  healthPercent: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function healthColor(percent: number): string {
  if (percent >= 80) return 'bg-green-500'
  if (percent >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function healthLabel(percent: number): string {
  if (percent >= 80) return 'Gut'
  if (percent >= 50) return 'Achtung'
  return 'Kritisch'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HoldingFinancePage() {
  await requireHoldingAdmin()

  const supabase = createSupabaseServerClient()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]!

  // 90-day window for cashflow overview
  const windowStart = new Date(today)
  windowStart.setDate(windowStart.getDate() - 30)
  const windowEnd = new Date(today)
  windowEnd.setDate(windowEnd.getDate() + 60)
  const fromStr = windowStart.toISOString().split('T')[0]!
  const toStr = windowEnd.toISOString().split('T')[0]!

  // Fetch all companies
  const { data: companiesRaw, error: compErr } = await supabase
    .from('companies')
    .select('id, name, slug')
    .eq('status', 'active')
    .order('name')

  if (compErr) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-medium text-red-900 mb-1">Fehler beim Laden</h2>
          <p className="text-sm text-red-700">
            Die Unternehmensdaten konnten nicht geladen werden.
          </p>
        </div>
      </div>
    )
  }

  const companies = (companiesRaw ?? []) as Array<{ id: string; name: string; slug: string }>

  // For each company, fetch aggregated liquidity data
  const companyLiquidity: CompanyLiquidity[] = await Promise.all(
    companies.map(async (company) => {
      // Fetch event instances in the window
      const { data: eventsRaw } = await supabase
        .from('liquidity_event_instances')
        .select('direction, budget_amount, actual_amount, actual_date')
        .eq('company_id', company.id)
        .eq('marker_type', 'event')
        .gte('budget_date', fromStr)
        .lte('budget_date', toStr)

      const events = (eventsRaw ?? []) as Array<{
        direction: string
        budget_amount: string | null
        actual_amount: string | null
        actual_date: string | null
      }>

      let totalPlanIncome = 0
      let totalPlanExpense = 0
      let totalActualIncome = 0
      let totalActualExpense = 0

      for (const evt of events) {
        const planAmt = Number(evt.budget_amount ?? 0)
        const actualAmt = Number(evt.actual_amount ?? 0)

        if (evt.direction === 'income') {
          totalPlanIncome += planAmt
          if (evt.actual_date) totalActualIncome += actualAmt
        } else {
          totalPlanExpense += planAmt
          if (evt.actual_date) totalActualExpense += actualAmt
        }
      }

      const netCashflow = totalActualIncome - totalActualExpense
      const plannedNet = totalPlanIncome - totalPlanExpense

      // Count overdue events
      const { count: overdueCount } = await supabase
        .from('liquidity_event_instances')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('marker_type', 'event')
        .lt('budget_date', todayStr)
        .is('actual_date', null)

      // Health: how well does actual track plan? (capped at 100)
      const totalPlan = totalPlanIncome + totalPlanExpense
      const totalActual = totalActualIncome + totalActualExpense
      const healthPercent =
        totalPlan > 0 ? Math.min(100, Math.round((totalActual / totalPlan) * 100)) : 100

      return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        netCashflow,
        overdueCount: overdueCount ?? 0,
        totalPlanIncome,
        totalPlanExpense,
        totalActualIncome,
        totalActualExpense,
        healthPercent,
      }
    }),
  )

  // Totals
  const totalOverdue = companyLiquidity.reduce((s, c) => s + c.overdueCount, 0)
  const totalNetCashflow = companyLiquidity.reduce((s, c) => s + c.netCashflow, 0)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Liquiditaetsuebersicht (Holding)
        </h1>
        <p className="text-gray-500 mt-1">
          Konsolidierte Finanzuebersicht aller Tochtergesellschaften &mdash; Stand: {formatDate(today)}
        </p>
      </div>

      {/* Holding-level KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Unternehmen</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">
            {companyLiquidity.length}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Gesamt Netto-Cashflow (Ist)</p>
          <p
            className={`text-2xl font-semibold mt-1 ${
              totalNetCashflow >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCHF(totalNetCashflow)}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Ueberfaellige Ereignisse (gesamt)</p>
          <p
            className={`text-2xl font-semibold mt-1 ${
              totalOverdue > 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {totalOverdue}
          </p>
        </div>
      </div>

      {/* Company table */}
      <div className="rounded-lg bg-white border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Unternehmen im Ueberblick
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-medium text-gray-500">Unternehmen</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Netto-Cashflow</th>
                <th className="px-6 py-3 text-center font-medium text-gray-500">Gesundheit</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Ueberfaellig</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Einnahmen (Ist)</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Ausgaben (Ist)</th>
              </tr>
            </thead>
            <tbody>
              {companyLiquidity.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Keine aktiven Unternehmen gefunden.
                  </td>
                </tr>
              )}
              {companyLiquidity.map((company) => (
                <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-6 py-3">
                    <Link
                      href={`/admin/finance/${company.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">
                    <span
                      className={
                        company.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {formatCHF(company.netCashflow)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${healthColor(company.healthPercent)}`}
                          style={{ width: `${company.healthPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-12 text-right">
                        {healthLabel(company.healthPercent)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">
                    {company.overdueCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {company.overdueCount}
                      </span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums text-gray-900">
                    {formatCHF(company.totalActualIncome)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums text-gray-900">
                    {formatCHF(company.totalActualExpense)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-gray-400">
        Zeitraum: {formatDate(windowStart)} bis {formatDate(windowEnd)}
      </p>
    </div>
  )
}
