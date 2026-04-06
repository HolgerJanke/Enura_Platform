import { createClient } from '@supabase/supabase-js'
import { callClaude } from '../../lib/ai/anthropic.js'
import { loadPrompt } from '../../ai/prompts/loader.js'
import { parseJsonResponse } from '../../ai/parse-json-response.js'
import { DailyReportResponseSchema } from '../../ai/schemas/daily-report-response.js'
import { assembleKpiData } from './assemble-kpis.js'

// ---------------------------------------------------------------------------
// Job data
// ---------------------------------------------------------------------------

export interface ReportJobData {
  tenantId: string
  /** ISO date string (YYYY-MM-DD) of the data day being reported on. */
  dataDate: string
  /** Whether this report was triggered by the scheduler or manually. */
  trigger: 'scheduled' | 'manual'
}

// ---------------------------------------------------------------------------
// Service client
// ---------------------------------------------------------------------------

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

/**
 * Daily report generation pipeline:
 *
 * 1. Assemble KPI data from pre-computed snapshots.
 * 2. Build prompt from versioned template files.
 * 3. Call Claude (claude-sonnet-4-6) for structured narrative report.
 * 4. Parse and validate the response with Zod.
 * 5. Look up report recipients (users with module:reports:read).
 * 6. Store the report in the `daily_reports` archive table.
 *
 * Email sending is handled by a separate step after this function returns,
 * so that report generation and delivery are decoupled.
 */
export async function processReportJob(
  job: ReportJobData,
): Promise<void> {
  const { tenantId, dataDate } = job
  const db = getServiceClient()
  const date = new Date(dataDate)

  // -----------------------------------------------------------------------
  // 1. Assemble KPI data
  // -----------------------------------------------------------------------
  const kpiData = await assembleKpiData(tenantId, date)

  // -----------------------------------------------------------------------
  // 2. Build prompt from versioned template files
  // -----------------------------------------------------------------------
  const systemPrompt = (await loadPrompt('daily-report-system'))
    .replace('{{COMPANY_NAME}}', kpiData.companyName)

  const userPrompt = (await loadPrompt('daily-report'))
    .replace('{{COMPANY_NAME}}', kpiData.companyName)
    .replace('{{REPORT_DATE}}', kpiData.reportDate)
    .replace('{{DATA_DATE}}', kpiData.dataDate)
    .replace('{{SETTER_KPIS_JSON}}', JSON.stringify(kpiData.setterKpis, null, 2))
    .replace('{{BERATER_KPIS_JSON}}', JSON.stringify(kpiData.beraterKpis, null, 2))
    .replace('{{LEADS_KPIS_JSON}}', JSON.stringify(kpiData.leadsKpis, null, 2))
    .replace('{{PROJECTS_KPIS_JSON}}', JSON.stringify(kpiData.projectsKpis, null, 2))
    .replace('{{FINANCE_KPIS_JSON}}', JSON.stringify(kpiData.financeKpis, null, 2))
    .replace('{{WARNINGS_JSON}}', JSON.stringify(kpiData.warnings, null, 2))

  // -----------------------------------------------------------------------
  // 3. Call Claude API (claude-sonnet-4-6)
  // -----------------------------------------------------------------------
  const rawResponse = await callClaude({
    systemPrompt,
    userMessage: userPrompt,
    maxTokens: 4000,
    temperature: 0.3,
  })

  // -----------------------------------------------------------------------
  // 4. Parse and validate structured JSON response
  // -----------------------------------------------------------------------
  const report = parseJsonResponse(rawResponse, DailyReportResponseSchema)

  // -----------------------------------------------------------------------
  // 5. Fetch report recipients
  //    Uses an RPC function that joins profiles -> profile_roles -> roles ->
  //    role_permissions -> permissions to find users with module:reports:read.
  // -----------------------------------------------------------------------
  const { data: recipients } = await db.rpc('get_report_recipients', {
    p_tenant_id: tenantId,
  })

  const emails = (
    (recipients as unknown as Array<{ email: string }>) ?? []
  ).map((r) => r.email)

  // -----------------------------------------------------------------------
  // 6. Store report in the daily_reports archive
  // -----------------------------------------------------------------------
  const reportDateStr = kpiData.reportDate

  const { error: upsertError } = await db.from('daily_reports').upsert(
    {
      tenant_id: tenantId,
      report_date: reportDateStr,
      report_json: report as unknown as Record<string, unknown>,
      kpi_data: kpiData as unknown as Record<string, unknown>,
      sent_to: emails,
      sent_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,report_date' },
  )

  if (upsertError) {
    throw new Error(
      `[daily-report] Failed to store report for tenant ${tenantId}: ${upsertError.message}`,
    )
  }

  console.log(
    `[daily-report] Generated for ${kpiData.companyName} ` +
      `(data: ${kpiData.dataDate}, report: ${reportDateStr}, ` +
      `recipients: ${emails.length}, warnings: ${kpiData.warnings.length})`,
  )
}
