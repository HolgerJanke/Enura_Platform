import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import {
  formatCHF,
  formatNumber,
  formatDate,
  KPI_SNAPSHOT_TYPES,
} from '@enura/types'
import type { FinanceMonthlyMetrics } from '@enura/types'

export default async function FinancePage() {
  await requirePermission('module:finance:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const db = getDataAccess()
  const today = new Date().toISOString().split('T')[0]!

  const snapshot = await db.kpis.findLatest(
    session.companyId,
    KPI_SNAPSHOT_TYPES.FINANCE_MONTHLY,
  )

  const metrics = snapshot?.metrics as FinanceMonthlyMetrics | undefined

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-semibold text-brand-text-primary mb-2">
        Finanzen &amp; Cashflow
      </h1>
      <p className="text-brand-text-secondary mb-6">{formatDate(today)}</p>

      {/* Primary financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">Monatsumsatz</p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatCHF(metrics?.revenue_total_chf ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Offene Forderungen
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatCHF(metrics?.open_receivables_chf ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Überfällige Rechnungen
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatNumber(metrics?.overdue_count ?? 0)}
          </p>
          <p className="text-xs text-brand-text-secondary mt-0.5">
            {formatCHF(metrics?.overdue_amount_chf ?? 0)}
          </p>
        </div>
        <div className="bg-brand-surface rounded-brand p-4 border border-gray-200">
          <p className="text-sm text-brand-text-secondary">
            Erhaltene Zahlungen
          </p>
          <p className="text-2xl font-semibold text-brand-text-primary mt-1">
            {formatCHF(metrics?.payments_received_chf ?? 0)}
          </p>
        </div>
      </div>

      {/* Liquidity forecast */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Liquiditätsprognose
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 text-left text-brand-text-secondary font-medium">
                  Zeitraum
                </th>
                <th className="py-2 text-right text-brand-text-secondary font-medium">
                  Prognose
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-primary">30 Tage</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatCHF(metrics?.forecast_30d_chf ?? 0)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-brand-text-primary">60 Tage</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatCHF(metrics?.forecast_60d_chf ?? 0)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-brand-text-primary">90 Tage</td>
                <td className="py-2 text-right font-medium text-brand-text-primary">
                  {formatCHF(metrics?.forecast_90d_chf ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">
            Cashflow-Diagramm
          </h2>
          <p className="text-sm text-brand-text-secondary">
            Cashflow-Verlauf wird mit dem Chart-Modul integriert.
          </p>
        </div>
      </div>

      {/* Liquidity warning */}
      {metrics &&
        metrics.forecast_30d_chf < 0 && (
          <div className="rounded-brand bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-medium text-red-800">
              Liquiditätswarnung
            </p>
            <p className="text-sm text-red-700 mt-1">
              Die 30-Tage-Liquiditätsprognose ist negativ (
              {formatCHF(metrics.forecast_30d_chf)}). Bitte prüfen Sie offene
              Forderungen und geplante Ausgaben.
            </p>
          </div>
        )}
    </div>
  )
}
