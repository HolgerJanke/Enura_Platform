'use client'

import { useState } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectorHealthLevel = 'green' | 'yellow' | 'red' | 'gray'

type ConnectorInfo = {
  type: string
  status: string
  lastSyncedAt: string | null
  lastError: string | null
}

type AnomalySummary = {
  tenantId: string
  activeCount: number
}

type TenantStats = {
  id: string
  name: string
  slug: string
  status: string
  createdAt: string
  userCount: number
  projectCount: number
  openReceivablesCHF: number
  connectors: ConnectorInfo[]
  lastActivityAt: string | null
  activeAnomalies: number
}

type AIUsageRow = {
  tenantId: string
  tenantName: string
  callsTranscribedMTD: number
  estimatedWhisperCostCHF: number
  reportsGenerated: number
  claudeTokensUsed: number
}

type AdminTabsProps = {
  tenantStats: TenantStats[]
  aiUsage: AIUsageRow[]
  summary: {
    totalCompanies: number
    totalUsers: number
    totalActiveProjects: number
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_CONNECTOR_TYPES = ['reonic', '3cx', 'bexio', 'google_calendar', 'leadnotes', 'whatsapp', 'gmail'] as const

const CONNECTOR_LABELS: Record<string, string> = {
  reonic: 'Reonic',
  '3cx': '3CX',
  bexio: 'Bexio',
  google_calendar: 'Google Cal',
  leadnotes: 'Leadnotes',
  whatsapp: 'WhatsApp',
  gmail: 'Gmail',
}

const HEALTH_DOT_CLASSES: Record<ConnectorHealthLevel, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  gray: 'bg-gray-300',
}

const HEALTH_CELL_TEXT: Record<ConnectorHealthLevel, string> = {
  green: 'text-green-700',
  yellow: 'text-yellow-700',
  red: 'text-red-700',
  gray: 'text-gray-400',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConnectorHealthLevel(connector: ConnectorInfo | undefined): ConnectorHealthLevel {
  if (!connector) return 'gray'
  if (connector.status === 'error') return 'red'
  if (!connector.lastSyncedAt) return 'red'

  const lastSync = new Date(connector.lastSyncedAt).getTime()
  const now = Date.now()
  const diffMinutes = (now - lastSync) / (1000 * 60)

  if (diffMinutes <= 20) return 'green'
  if (diffMinutes <= 120) return 'yellow'
  return 'red'
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / (1000 * 60))

  if (minutes < 1) return 'Gerade eben'
  if (minutes < 60) return `vor ${minutes} Min.`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours} Std.`

  const days = Math.floor(hours / 24)
  return `vor ${days} Tag${days > 1 ? 'en' : ''}`
}

function formatCHF(amount: number): string {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(amount)
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('de-CH').format(n)
}

function statusBadge(status: string): { label: string; classes: string } {
  switch (status) {
    case 'active':
      return { label: 'Aktiv', classes: 'bg-green-100 text-green-700' }
    case 'suspended':
      return { label: 'Gesperrt', classes: 'bg-red-100 text-red-700' }
    case 'archived':
      return { label: 'Archiviert', classes: 'bg-gray-100 text-gray-500' }
    default:
      return { label: status, classes: 'bg-gray-100 text-gray-500' }
  }
}

function connectorCellDisplay(connector: ConnectorInfo | undefined): { symbol: string; time: string } {
  if (!connector) return { symbol: '\u2014', time: '' }
  if (connector.status === 'error') return { symbol: '\u2717 ERR', time: connector.lastError ?? '' }
  if (!connector.lastSyncedAt) return { symbol: '\u2717', time: 'Noch nie' }
  return { symbol: '\u2713', time: formatRelativeTime(connector.lastSyncedAt) }
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type Tab = 'uebersicht' | 'connectors' | 'ki'

const TABS: { key: Tab; label: string }[] = [
  { key: 'uebersicht', label: 'Uebersicht' },
  { key: 'connectors', label: 'Connectors' },
  { key: 'ki', label: 'KI-Nutzung' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminTabs({ tenantStats, aiUsage, summary }: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('uebersicht')

  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6" aria-label="Admin-Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              aria-current={activeTab === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ================================================================== */}
      {/* Tab 1: Uebersicht                                                 */}
      {/* ================================================================== */}
      {activeTab === 'uebersicht' && (
        <div>
          {/* Summary row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <SummaryCard
              icon={
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
              }
              iconBg="bg-blue-50"
              label="Aktive Unternehmen"
              value={summary.totalCompanies}
            />
            <SummaryCard
              icon={
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              }
              iconBg="bg-green-50"
              label="Gesamte Benutzer"
              value={summary.totalUsers}
            />
            <SummaryCard
              icon={
                <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              }
              iconBg="bg-purple-50"
              label="Aktive Projekte"
              value={summary.totalActiveProjects}
            />
          </div>

          {/* Tenant cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tenantStats.length === 0 ? (
              <div className="col-span-full rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
                Noch keine Unternehmen registriert.
              </div>
            ) : (
              tenantStats.map((tenant) => {
                const badge = statusBadge(tenant.status)
                const activeConnectors = tenant.connectors.filter((c) => c.status === 'active').length
                const totalConnectors = tenant.connectors.length

                return (
                  <Link
                    key={tenant.id}
                    href={`/admin/tenants/${tenant.slug}`}
                    className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white">
                          {tenant.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{tenant.slug}</p>
                        </div>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Benutzer</p>
                        <p className="font-medium text-gray-900 tabular-nums">{tenant.userCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Aktive Projekte</p>
                        <p className="font-medium text-gray-900 tabular-nums">{tenant.projectCount}</p>
                      </div>
                    </div>

                    {/* Connector health dots */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500">Connectors:</span>
                      <div className="flex items-center gap-1">
                        {KNOWN_CONNECTOR_TYPES.map((connType) => {
                          const connector = tenant.connectors.find((c) => c.type === connType)
                          const health = getConnectorHealthLevel(connector)
                          const label = CONNECTOR_LABELS[connType] ?? connType
                          return (
                            <span
                              key={connType}
                              title={`${label}`}
                              aria-label={`${label}: ${health}`}
                              className={`inline-block h-2 w-2 rounded-full ${HEALTH_DOT_CLASSES[health]}`}
                            />
                          )
                        })}
                      </div>
                      {totalConnectors > 0 && (
                        <span className="text-xs text-gray-400">
                          {activeConnectors}/{totalConnectors}
                        </span>
                      )}
                    </div>

                    {/* Anomalies badge */}
                    {tenant.activeAnomalies > 0 && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          {tenant.activeAnomalies} Anomalie{tenant.activeAnomalies !== 1 ? 'n' : ''}
                        </span>
                      </div>
                    )}

                    {/* Last activity */}
                    <div className="text-xs text-gray-400 border-t border-gray-100 pt-2 mt-2">
                      Letzte Aktivitaet:{' '}
                      {tenant.lastActivityAt ? formatRelativeTime(tenant.lastActivityAt) : 'Keine'}
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Tab 2: Connectors                                                 */}
      {/* ================================================================== */}
      {activeTab === 'connectors' && (
        <div>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-medium text-gray-900">Connector-Status aller Unternehmen</h2>
              <p className="text-sm text-gray-500 mt-1">
                Uebersicht ueber den Synchronisationsstatus aller konfigurierten Konnektoren.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sticky left-0 bg-gray-50">
                      Unternehmen
                    </th>
                    {KNOWN_CONNECTOR_TYPES.map((connType) => (
                      <th
                        key={connType}
                        className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        {CONNECTOR_LABELS[connType] ?? connType}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tenantStats.length === 0 ? (
                    <tr>
                      <td colSpan={KNOWN_CONNECTOR_TYPES.length + 1} className="px-4 py-8 text-center text-sm text-gray-500">
                        Keine Unternehmen vorhanden.
                      </td>
                    </tr>
                  ) : (
                    tenantStats.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          <Link href={`/admin/tenants/${tenant.slug}`} className="hover:text-blue-600 hover:underline">
                            {tenant.name}
                          </Link>
                        </td>
                        {KNOWN_CONNECTOR_TYPES.map((connType) => {
                          const connector = tenant.connectors.find((c) => c.type === connType)
                          const health = getConnectorHealthLevel(connector)
                          const display = connectorCellDisplay(connector)

                          return (
                            <td
                              key={connType}
                              className="px-4 py-3 text-center"
                              title={connector?.lastError ?? undefined}
                            >
                              <div className={`text-sm font-medium ${HEALTH_CELL_TEXT[health]}`}>
                                {display.symbol}
                              </div>
                              {display.time && (
                                <div className="text-xs text-gray-400 mt-0.5">{display.time}</div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Synchron ({'<'}20 Min.)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
              Verzoegert (20 Min. - 2 Std.)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              Fehler / Veraltet ({'>'}2 Std.)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
              Nicht konfiguriert
            </span>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Tab 3: KI-Nutzung                                                 */}
      {/* ================================================================== */}
      {activeTab === 'ki' && (
        <div>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-medium text-gray-900">KI-Nutzung (aktueller Monat)</h2>
              <p className="text-sm text-gray-500 mt-1">
                Whisper-Transkriptionen, Claude-Tokens und geschaetzte Kosten pro Unternehmen.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Unternehmen
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Transkriptionen (MTD)
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Geschaetzte Whisper-Kosten
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Berichte generiert
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Claude-Tokens
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {aiUsage.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">
                        Keine KI-Nutzungsdaten vorhanden.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {aiUsage.map((row) => (
                        <tr key={row.tenantId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-sm font-medium text-gray-900">{row.tenantName}</td>
                          <td className="px-5 py-3 text-sm text-gray-700 text-right tabular-nums">
                            {formatNumber(row.callsTranscribedMTD)}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700 text-right tabular-nums">
                            {formatCHF(row.estimatedWhisperCostCHF)}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700 text-right tabular-nums">
                            {formatNumber(row.reportsGenerated)}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700 text-right tabular-nums">
                            {formatNumber(row.claudeTokensUsed)}
                          </td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr className="bg-gray-50 font-medium">
                        <td className="px-5 py-3 text-sm text-gray-900">Gesamt</td>
                        <td className="px-5 py-3 text-sm text-gray-900 text-right tabular-nums">
                          {formatNumber(aiUsage.reduce((s, r) => s + r.callsTranscribedMTD, 0))}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-900 text-right tabular-nums">
                          {formatCHF(aiUsage.reduce((s, r) => s + r.estimatedWhisperCostCHF, 0))}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-900 text-right tabular-nums">
                          {formatNumber(aiUsage.reduce((s, r) => s + r.reportsGenerated, 0))}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-900 text-right tabular-nums">
                          {formatNumber(aiUsage.reduce((s, r) => s + r.claudeTokensUsed, 0))}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}
