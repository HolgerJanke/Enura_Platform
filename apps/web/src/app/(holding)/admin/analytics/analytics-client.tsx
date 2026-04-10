'use client'

import { useState, useTransition } from 'react'
import {
  getHoldingKpis,
  type HoldingKpiSummary,
  type CompanyKpi,
  type AnomalySummary,
  type ComplianceSummary,
} from './actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Period = 30 | 90 | 180

type AnalyticsClientProps = {
  initialKpis: HoldingKpiSummary
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  trend,
  trendLabel,
}: {
  label: string
  value: string
  trend: 'up' | 'down' | 'neutral'
  trendLabel: string
}) {
  const trendColor =
    trend === 'up'
      ? 'text-green-600'
      : trend === 'down'
        ? 'text-red-600'
        : 'text-gray-500'

  const trendArrow =
    trend === 'up' ? (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ) : trend === 'down' ? (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ) : null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <div className={`mt-2 flex items-center gap-1 text-sm ${trendColor}`}>
        {trendArrow}
        <span>{trendLabel}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Horizontal Bar
// ---------------------------------------------------------------------------

function HorizontalBar({
  label,
  value,
  maxValue,
  color,
}: {
  label: string
  value: number
  maxValue: number
  color: string
}) {
  const widthPct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-sm text-gray-700">{label}</span>
      <div className="flex-1">
        <div className="h-5 w-full rounded-full bg-gray-100">
          <div
            className="h-5 rounded-full transition-all duration-300"
            style={{ width: `${widthPct}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <span className="w-16 text-right text-sm font-medium text-gray-900">
        {value.toLocaleString('de-CH')}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Anomaly Row
// ---------------------------------------------------------------------------

function AnomalyRow({ anomaly }: { anomaly: AnomalySummary }) {
  const severityColor =
    anomaly.severity === 'high'
      ? 'bg-red-100 text-red-700'
      : anomaly.severity === 'medium'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-600'

  const severityLabel =
    anomaly.severity === 'high'
      ? 'Hoch'
      : anomaly.severity === 'medium'
        ? 'Mittel'
        : 'Niedrig'

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3">
      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${severityColor}`}>
        {severityLabel}
      </span>
      <div>
        <p className="text-sm font-medium text-gray-900">{anomaly.companyName}</p>
        <p className="text-sm text-gray-500">{anomaly.description}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compliance Summary
// ---------------------------------------------------------------------------

function ComplianceCard({ compliance }: { compliance: ComplianceSummary }) {
  const fulfillmentPct =
    compliance.totalChecks > 0
      ? Math.round((compliance.fulfilled / compliance.totalChecks) * 100)
      : 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Compliance</h3>
      <div className="mt-4 grid grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{compliance.totalChecks}</p>
          <p className="text-xs text-gray-500">Gesamt</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-600">{compliance.fulfilled}</p>
          <p className="text-xs text-gray-500">Erfüllt</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-yellow-600">{compliance.pending}</p>
          <p className="text-xs text-gray-500">Ausstehend</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-red-600">{compliance.overdue}</p>
          <p className="text-xs text-gray-500">Überfällig</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Erfuellungsrate</span>
          <span>{fulfillmentPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-green-500 transition-all duration-300"
            style={{ width: `${fulfillmentPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AnalyticsClient({ initialKpis }: AnalyticsClientProps) {
  const [period, setPeriod] = useState<Period>(30)
  const [kpis, setKpis] = useState<HoldingKpiSummary>(initialKpis)
  const [isPending, startTransition] = useTransition()

  function handlePeriodChange(newPeriod: Period) {
    setPeriod(newPeriod)
    startTransition(async () => {
      const data = await getHoldingKpis(newPeriod)
      setKpis(data)
    })
  }

  // Determine max values for bar charts
  const maxLeads = Math.max(...kpis.companyKpis.map((c) => c.totalLeads), 1)
  const maxOffers = Math.max(...kpis.companyKpis.map((c) => c.wonOffers), 1)

  // Format currency
  const formatCHF = (value: number) =>
    new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
      maximumFractionDigits: 0,
    }).format(value)

  const periodLabels: Record<Period, string> = {
    30: '30 Tage',
    90: '90 Tage',
    180: '180 Tage',
  }

  return (
    <div className="space-y-8">
      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Zeitraum:</span>
        {([30, 90, 180] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handlePeriodChange(p)}
            disabled={isPending}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              period === p
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50`}
            aria-label={`Zeitraum ${periodLabels[p]} auswählen`}
            aria-pressed={period === p}
          >
            {periodLabels[p]}
          </button>
        ))}
        {isPending && (
          <svg className="ml-2 h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Leads"
          value={kpis.totalLeads.toLocaleString('de-CH')}
          trend={kpis.totalLeads > 0 ? 'up' : 'neutral'}
          trendLabel={`${kpis.totalCompanies} Unternehmen`}
        />
        <KpiCard
          label="Abschlüsse"
          value={kpis.totalWonOffers.toLocaleString('de-CH')}
          trend={kpis.totalWonOffers > 0 ? 'up' : 'neutral'}
          trendLabel={
            kpis.totalLeads > 0
              ? `${Math.round((kpis.totalWonOffers / kpis.totalLeads) * 100)}% Abschlussrate`
              : 'Keine Leads'
          }
        />
        <KpiCard
          label="Umsatz"
          value={formatCHF(kpis.totalRevenue)}
          trend={kpis.totalRevenue > 0 ? 'up' : 'neutral'}
          trendLabel={`${periodLabels[period]}`}
        />
        <KpiCard
          label="KI-Anrufe analysiert"
          value={kpis.totalAiCalls.toLocaleString('de-CH')}
          trend={kpis.totalAiCalls > 0 ? 'up' : 'neutral'}
          trendLabel={`${kpis.totalActiveUsers} aktive Benutzer`}
        />
      </div>

      {/* Company Comparison */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Leads per company */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Leads pro Unternehmen</h3>
          {kpis.companyKpis.length === 0 ? (
            <p className="text-sm text-gray-500">Keine Unternehmen vorhanden.</p>
          ) : (
            <div className="space-y-3">
              {kpis.companyKpis
                .sort((a, b) => b.totalLeads - a.totalLeads)
                .map((company) => (
                  <HorizontalBar
                    key={company.companyId}
                    label={company.companyName}
                    value={company.totalLeads}
                    maxValue={maxLeads}
                    color="#1A56DB"
                  />
                ))}
            </div>
          )}
        </div>

        {/* Offers per company */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Abschlüsse pro Unternehmen</h3>
          {kpis.companyKpis.length === 0 ? (
            <p className="text-sm text-gray-500">Keine Unternehmen vorhanden.</p>
          ) : (
            <div className="space-y-3">
              {kpis.companyKpis
                .sort((a, b) => b.wonOffers - a.wonOffers)
                .map((company) => (
                  <HorizontalBar
                    key={company.companyId}
                    label={company.companyName}
                    value={company.wonOffers}
                    maxValue={maxOffers}
                    color="#F3A917"
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Anomalies + Compliance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Anomalies */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Anomalien</h3>
          {kpis.anomalies.length === 0 ? (
            <p className="text-sm text-gray-500">Keine Anomalien erkannt.</p>
          ) : (
            <div className="space-y-2">
              {kpis.anomalies.map((anomaly, idx) => (
                <AnomalyRow key={`${anomaly.companyName}-${idx}`} anomaly={anomaly} />
              ))}
            </div>
          )}
        </div>

        {/* Compliance */}
        <ComplianceCard compliance={kpis.compliance} />
      </div>
    </div>
  )
}
