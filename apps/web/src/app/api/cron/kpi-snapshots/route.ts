import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron job: compute and upsert per-tenant KPI snapshots that the
 * dashboards (Lead-Kontrolle, Projects, Berater overview) read from.
 *
 * Triggers:
 * - Vercel Cron (configured in `vercel.json`)
 * - Manual fetch (with CRON_SECRET) for ad-hoc recompute
 *
 * Snapshot types written here (the dashboards read from `kpi_snapshots`
 * with these `snapshot_type` values):
 *   - leads_daily            — per-tenant lead counts/funnel
 *   - projects_daily         — per-tenant project counts and portfolio
 *   - berater_daily          — per-team-member offer pipeline (entity_id = team_member.id)
 *   - tenant_daily_summary   — combined snapshot for the tenant overview
 *
 * `setter_daily` and `finance_monthly` are NOT computed here yet — those
 * depend on the 3CX call data and the more complex bexio aggregation,
 * which are scheduled to follow once 3CX is wired up.
 */

type Row = Record<string, unknown>

function countBy(rows: Row[], key: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const v = String(r[key] ?? 'unknown')
    out[v] = (out[v] ?? 0) + 1
  }
  return out
}

function sumBy(rows: Row[], key: string): number {
  let total = 0
  for (const r of rows) {
    const v = Number(r[key])
    if (Number.isFinite(v)) total += v
  }
  return total
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseServiceClient()
  const now = new Date()
  const today = now.toISOString().split('T')[0]!
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999)

  const summary: Array<Record<string, unknown>> = []

  const { data: companies, error: companiesError } = await db
    .from('companies')
    .select('id, name')
    .eq('status', 'active')

  if (companiesError) {
    return NextResponse.json({ error: companiesError.message }, { status: 500 })
  }

  for (const c of (companies ?? []) as Row[]) {
    const companyId = c['id'] as string
    const companyName = (c['name'] as string) ?? 'unknown'

    // ----- LEADS -----
    const { data: leads } = await db
      .from('leads')
      .select('id, status, source, created_at')
      .eq('company_id', companyId)

    const leadsList = (leads ?? []) as Row[]
    const leadsToday = leadsList.filter((l) => {
      const t = new Date(l['created_at'] as string).getTime()
      return t >= dayStart.getTime() && t <= dayEnd.getTime()
    })

    const leadsMetrics = {
      total: leadsList.length,
      new_today: leadsToday.length,
      by_status: countBy(leadsList, 'status'),
      by_source: countBy(leadsList, 'source'),
    }

    await db.from('kpi_snapshots').upsert({
      company_id: companyId,
      snapshot_type: 'leads_daily',
      entity_id: null,
      period_date: today,
      metrics: leadsMetrics,
    }, { onConflict: 'company_id,snapshot_type,entity_id,period_date' })

    // ----- PROJECTS -----
    const { data: projects } = await db
      .from('projects')
      .select('id, status, project_value, current_step_id')
      .eq('company_id', companyId)

    const projectsList = (projects ?? []) as Row[]
    const projectsMetrics = {
      total: projectsList.length,
      active: projectsList.filter((p) => p['status'] === 'active').length,
      total_value: sumBy(projectsList, 'project_value'),
      by_step: countBy(projectsList, 'current_step_id'),
      by_status: countBy(projectsList, 'status'),
    }

    await db.from('kpi_snapshots').upsert({
      company_id: companyId,
      snapshot_type: 'projects_daily',
      entity_id: null,
      period_date: today,
      metrics: projectsMetrics,
    }, { onConflict: 'company_id,snapshot_type,entity_id,period_date' })

    // ----- BERATER (per team_member) -----
    const { data: members } = await db
      .from('team_members')
      .select('id, role_type')
      .eq('company_id', companyId)
      .eq('is_active', true)

    const beraters = ((members ?? []) as Row[]).filter((m) => m['role_type'] === 'berater')
    let beraterSnapshotsWritten = 0

    for (const b of beraters) {
      const beraterId = b['id'] as string

      const { data: offers } = await db
        .from('offers')
        .select('id, status, value, total_price, created_at')
        .eq('company_id', companyId)
        .eq('assigned_user_id', beraterId)

      const offersList = (offers ?? []) as Row[]
      const won = offersList.filter((o) => String(o['status']).toLowerCase().includes('won') || String(o['status']).toLowerCase().includes('gewonnen'))
      const open = offersList.filter((o) => {
        const s = String(o['status']).toLowerCase()
        return !s.includes('won') && !s.includes('lost') && !s.includes('verloren') && !s.includes('done')
      })

      const beraterMetrics = {
        offers_total: offersList.length,
        offers_open: open.length,
        offers_won: won.length,
        total_value: sumBy(offersList, 'value') + sumBy(offersList, 'total_price'),
        won_value: sumBy(won, 'value') + sumBy(won, 'total_price'),
        win_rate: offersList.length > 0 ? Math.round((won.length / offersList.length) * 1000) / 10 : 0,
      }

      await db.from('kpi_snapshots').upsert({
        company_id: companyId,
        snapshot_type: 'berater_daily',
        entity_id: beraterId,
        period_date: today,
        metrics: beraterMetrics,
      }, { onConflict: 'company_id,snapshot_type,entity_id,period_date' })

      beraterSnapshotsWritten++
    }

    // ----- TENANT DAILY SUMMARY -----
    await db.from('kpi_snapshots').upsert({
      company_id: companyId,
      snapshot_type: 'tenant_daily_summary',
      entity_id: null,
      period_date: today,
      metrics: {
        leads: leadsMetrics,
        projects: projectsMetrics,
        beraters_active: beraters.length,
      },
    }, { onConflict: 'company_id,snapshot_type,entity_id,period_date' })

    summary.push({
      company: companyName,
      leads_total: leadsList.length,
      leads_new_today: leadsToday.length,
      projects_total: projectsList.length,
      berater_snapshots: beraterSnapshotsWritten,
    })
  }

  return NextResponse.json({
    success: true,
    date: today,
    companies_processed: (companies ?? []).length,
    summary,
  })
}
