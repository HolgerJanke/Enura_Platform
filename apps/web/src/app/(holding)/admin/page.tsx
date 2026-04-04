import Link from 'next/link'
import { requireHoldingAdmin } from '@/lib/permissions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@enura/types'
import { AdminTabs } from './admin-tabs'

// ---------------------------------------------------------------------------
// Types (server-side data shapes)
// ---------------------------------------------------------------------------

interface ConnectorInfo {
  type: string
  status: string
  lastSyncedAt: string | null
  lastError: string | null
}

interface TenantStats {
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

interface AIUsageRow {
  companyId: string
  companyName: string
  callsTranscribedMTD: number
  estimatedWhisperCostCHF: number
  reportsGenerated: number
  claudeTokensUsed: number
}

// ---------------------------------------------------------------------------
// Whisper cost estimation: ~$0.006/min, average call ~4 min
// ---------------------------------------------------------------------------
const WHISPER_COST_PER_CALL_CHF = 0.024

export default async function HoldingAdminPage() {
  await requireHoldingAdmin()

  const supabase = createSupabaseServerClient()

  // -----------------------------------------------------------------------
  // Fetch all tenants
  // -----------------------------------------------------------------------
  const { data: tenants, error: tenantsError } = await supabase
    .from('companies')
    .select('id, name, slug, status, created_at')
    .order('name')

  if (tenantsError) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-medium text-red-900 mb-1">Fehler beim Laden</h2>
          <p className="text-sm text-red-700">
            Die Unternehmensdaten konnten nicht geladen werden. Bitte versuchen Sie es erneut.
          </p>
        </div>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // For each tenant, fetch aggregated counts, connectors, anomalies, AI data
  // -----------------------------------------------------------------------
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const tenantStats: TenantStats[] = await Promise.all(
    ((tenants ?? []) as Record<string, unknown>[]).map(async (tenant) => {
      const companyId = tenant['id'] as string

      const [userCount, projectCount, invoiceData, connectorsData, anomalyData, lastActivityData] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId),
          supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('status', 'active'),
          supabase
            .from('invoices')
            .select('total_chf, status')
            .eq('company_id', companyId)
            .in('status', ['sent', 'partially_paid']),
          supabase
            .from('connectors')
            .select('type, status, last_synced_at, last_error')
            .eq('company_id', companyId),
          supabase
            .from('anomalies')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('is_active', true),
          supabase
            .from('audit_log')
            .select('created_at')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(1),
        ])

      const openReceivables = ((invoiceData.data ?? []) as Record<string, unknown>[]).reduce(
        (sum: number, inv) => sum + Number(inv['total_chf'] ?? 0),
        0,
      )

      const connectors: ConnectorInfo[] = (
        (connectorsData.data ?? []) as Record<string, unknown>[]
      ).map((c) => ({
        type: c['type'] as string,
        status: c['status'] as string,
        lastSyncedAt: (c['last_synced_at'] as string | null) ?? null,
        lastError: (c['last_error'] as string | null) ?? null,
      }))

      const lastActivityRow = (lastActivityData.data ?? [])[0] as
        | Record<string, unknown>
        | undefined
      const lastActivityAt = lastActivityRow
        ? (lastActivityRow['created_at'] as string | null)
        : null

      return {
        id: companyId,
        name: tenant['name'] as string,
        slug: tenant['slug'] as string,
        status: tenant['status'] as string,
        createdAt: tenant['created_at'] as string,
        userCount: userCount.count ?? 0,
        projectCount: projectCount.count ?? 0,
        openReceivablesCHF: openReceivables,
        connectors,
        lastActivityAt,
        activeAnomalies: anomalyData.count ?? 0,
      }
    }),
  )

  // -----------------------------------------------------------------------
  // AI usage data (transcription_usage + daily_reports)
  // -----------------------------------------------------------------------
  const aiUsage: AIUsageRow[] = await Promise.all(
    ((tenants ?? []) as Record<string, unknown>[]).map(async (tenant) => {
      const companyId = tenant['id'] as string
      const companyName = tenant['name'] as string

      const [transcriptionData, reportData] = await Promise.all([
        supabase
          .from('call_analysis')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', monthStart),
        supabase
          .from('daily_reports')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', monthStart),
      ])

      const callsTranscribed = transcriptionData.count ?? 0
      const reportsGenerated = reportData.count ?? 0

      // Estimate: ~800 tokens per call analysis, ~3000 tokens per report
      const claudeTokensUsed = callsTranscribed * 800 + reportsGenerated * 3000

      return {
        companyId,
        companyName,
        callsTranscribedMTD: callsTranscribed,
        estimatedWhisperCostCHF: callsTranscribed * WHISPER_COST_PER_CALL_CHF,
        reportsGenerated,
        claudeTokensUsed,
      }
    }),
  )

  // -----------------------------------------------------------------------
  // Summary stats
  // -----------------------------------------------------------------------
  const activeCompanies = tenantStats.filter((t) => t.status === 'active').length
  const totalUsers = tenantStats.reduce((s, t) => s + t.userCount, 0)
  const totalProjects = tenantStats.reduce((s, t) => s + t.projectCount, 0)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Holding-Uebersicht</h1>
          <p className="text-gray-500 mt-1">
            Cross-Tenant Health Monitoring &mdash; Aggregierte Kennzahlen aller Tochtergesellschaften
          </p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Neues Unternehmen
        </Link>
      </div>

      {/* Tabbed dashboard */}
      <AdminTabs
        tenantStats={tenantStats}
        aiUsage={aiUsage}
        summary={{
          totalCompanies: activeCompanies,
          totalUsers,
          totalActiveProjects: totalProjects,
        }}
      />

      {/* Footer info */}
      <p className="mt-6 text-xs text-gray-400">
        Datenstand: {formatDate(new Date())}
      </p>
    </div>
  )
}
