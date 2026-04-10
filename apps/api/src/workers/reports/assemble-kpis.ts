import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Warning {
  type: 'stalled_project' | 'overdue_invoice' | 'unworked_leads' | 'connector_error'
  severity: 'high' | 'medium' | 'low'
  message: string
  count?: number
  amount?: number
}

export interface ReportKpiData {
  /** ISO date of the report itself (day after data date). */
  reportDate: string
  /** ISO date of the data being summarised. */
  dataDate: string
  /** Tenant company name. */
  companyName: string
  /** Per-setter KPI snapshots. */
  setterKpis: Array<{ name: string; metrics: Record<string, unknown> }>
  /** Per-berater KPI snapshots. */
  beraterKpis: Array<{ name: string; metrics: Record<string, unknown> }>
  /** Aggregated lead metrics for the day. */
  leadsKpis: Record<string, unknown>
  /** Aggregated project metrics. */
  projectsKpis: Record<string, unknown>
  /** Monthly finance metrics. */
  financeKpis: Record<string, unknown>
  /** Warnings and alerts. */
  warnings: Warning[]
}

// ---------------------------------------------------------------------------
// Service client
// ---------------------------------------------------------------------------

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0]!
}

/**
 * Fetches a single KPI snapshot for a given type, entity, and date.
 */
async function fetchSnapshot(
  db: SupabaseClient,
  companyId: string,
  snapshotType: string,
  entityId: string | null,
  periodDate: string,
): Promise<Record<string, unknown>> {
  const query = db
    .from('kpi_snapshots')
    .select('metrics')
    .eq('company_id', companyId)
    .eq('snapshot_type', snapshotType)
    .eq('period_date', periodDate)

  if (entityId) {
    query.eq('entity_id', entityId)
  } else {
    query.is('entity_id', null)
  }

  const { data } = await query.maybeSingle()

  if (!data) return {}
  return (data as Record<string, unknown>)['metrics'] as Record<string, unknown> ?? {}
}

// ---------------------------------------------------------------------------
// Main assembler
// ---------------------------------------------------------------------------

/**
 * Assembles all KPI data needed for the daily report.
 *
 * Reads from pre-computed `kpi_snapshots` (never raw tables),
 * then builds a warnings list based on threshold checks.
 *
 * @param companyId  The tenant to assemble data for.
 * @param date      The data date (the day being reported on, not the report date).
 */
export async function assembleKpiData(
  companyId: string,
  date: Date,
): Promise<ReportKpiData> {
  const db = getServiceClient()
  const periodDate = toISODateString(date)
  const reportDate = toISODateString(
    new Date(date.getTime() + 86_400_000),
  )

  // -----------------------------------------------------------------------
  // 1. Fetch tenant name
  // -----------------------------------------------------------------------
  const { data: tenant } = await db
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single()

  const companyName =
    (tenant as Record<string, unknown> | null)?.['name'] as string ?? 'Unbekanntes Unternehmen'

  // -----------------------------------------------------------------------
  // 2. Fetch all active team members with their roles
  // -----------------------------------------------------------------------
  const { data: members } = await db
    .from('team_members')
    .select('id, first_name, last_name, display_name, role_type')
    .eq('company_id', companyId)
    .eq('is_active', true)

  const teamMembers = (members ?? []) as Array<Record<string, unknown>>

  const setters = teamMembers.filter((m) => m['role_type'] === 'setter')
  const beraters = teamMembers.filter((m) => m['role_type'] === 'berater')

  // -----------------------------------------------------------------------
  // 3. Fetch setter_daily snapshots for each setter
  // -----------------------------------------------------------------------
  const setterKpis: ReportKpiData['setterKpis'] = []

  for (const setter of setters) {
    const metrics = await fetchSnapshot(
      db,
      companyId,
      'setter_daily',
      setter['id'] as string,
      periodDate,
    )

    const name =
      (setter['display_name'] as string) ||
      `${setter['first_name'] as string} ${setter['last_name'] as string}`

    setterKpis.push({ name, metrics })
  }

  // -----------------------------------------------------------------------
  // 4. Fetch berater_daily snapshots for each berater
  // -----------------------------------------------------------------------
  const beraterKpis: ReportKpiData['beraterKpis'] = []

  for (const berater of beraters) {
    const metrics = await fetchSnapshot(
      db,
      companyId,
      'berater_daily',
      berater['id'] as string,
      periodDate,
    )

    const name =
      (berater['display_name'] as string) ||
      `${berater['first_name'] as string} ${berater['last_name'] as string}`

    beraterKpis.push({ name, metrics })
  }

  // -----------------------------------------------------------------------
  // 5. Fetch aggregated snapshots (leads, projects, finance)
  // -----------------------------------------------------------------------
  const leadsKpis = await fetchSnapshot(
    db,
    companyId,
    'leads_daily',
    null,
    periodDate,
  )

  const projectsKpis = await fetchSnapshot(
    db,
    companyId,
    'projects_daily',
    null,
    periodDate,
  )

  const financeKpis = await fetchSnapshot(
    db,
    companyId,
    'finance_monthly',
    null,
    periodDate,
  )

  // -----------------------------------------------------------------------
  // 6. Build warnings
  // -----------------------------------------------------------------------
  const warnings: Warning[] = []

  // 6a. Stalled projects (>7 days in a phase)
  const stalledCount = (projectsKpis['stalled_count'] as number) ?? 0
  if (stalledCount > 0) {
    warnings.push({
      type: 'stalled_project',
      severity: stalledCount >= 5 ? 'high' : 'medium',
      message: `${stalledCount} Projekt${stalledCount === 1 ? '' : 'e'} stagnieren seit mehr als 7 Tagen in einer Phase.`,
      count: stalledCount,
    })
  }

  // 6b. Overdue invoices
  const overdueCount = (financeKpis['overdue_count'] as number) ?? 0
  const overdueAmount = (financeKpis['overdue_amount_chf'] as number) ?? 0
  if (overdueCount > 0) {
    warnings.push({
      type: 'overdue_invoice',
      severity: overdueAmount > 50_000 ? 'high' : overdueCount >= 3 ? 'medium' : 'low',
      message: `${overdueCount} überfällige Rechnung${overdueCount === 1 ? '' : 'en'} (CHF ${overdueAmount.toLocaleString('de-CH', { minimumFractionDigits: 2 })}).`,
      count: overdueCount,
      amount: overdueAmount,
    })
  }

  // 6c. Unworked leads (>4h without contact)
  const unworkedCount = (leadsKpis['leads_unworked_count'] as number) ?? 0
  if (unworkedCount > 0) {
    warnings.push({
      type: 'unworked_leads',
      severity: unworkedCount >= 10 ? 'high' : unworkedCount >= 5 ? 'medium' : 'low',
      message: `${unworkedCount} Lead${unworkedCount === 1 ? '' : 's'} seit mehr als 4 Stunden unbearbeitet.`,
      count: unworkedCount,
    })
  }

  // 6d. Connector errors
  const { data: errorConnectors } = await db
    .from('connectors')
    .select('name, last_error')
    .eq('company_id', companyId)
    .eq('status', 'error')

  const connErrors = errorConnectors ?? []
  for (const conn of connErrors) {
    const connRecord = conn as Record<string, unknown>
    warnings.push({
      type: 'connector_error',
      severity: 'high',
      message: `Connector "${connRecord['name'] as string}" meldet Fehler: ${(connRecord['last_error'] as string) ?? 'Unbekannter Fehler'}.`,
    })
  }

  // -----------------------------------------------------------------------
  // 7. Return assembled data
  // -----------------------------------------------------------------------
  return {
    reportDate,
    dataDate: periodDate,
    companyName,
    setterKpis,
    beraterKpis,
    leadsKpis,
    projectsKpis,
    financeKpis,
    warnings,
  }
}
