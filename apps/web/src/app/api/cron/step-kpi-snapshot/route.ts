import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Cron job: snapshot project counts and portfolio values per process step.
 * Runs daily at 02:00 UTC via Vercel Cron.
 *
 * Authorization: requires CRON_SECRET header to prevent unauthorized calls.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseServiceClient()
  const today = new Date().toISOString().split('T')[0]!

  // Fetch all active projects with their current step
  const { data: projects, error: projError } = await db
    .from('projects')
    .select('company_id, current_step_id, project_value')
    .eq('status', 'active')
    .not('current_step_id', 'is', null)

  if (projError) {
    return NextResponse.json({ error: projError.message }, { status: 500 })
  }

  // Aggregate by company + step
  const aggregated = new Map<string, { company_id: string; step_id: string; count: number; value: number }>()
  for (const proj of (projects ?? []) as Array<Record<string, unknown>>) {
    const key = `${proj['company_id']}::${proj['current_step_id']}`
    const existing = aggregated.get(key) ?? {
      company_id: proj['company_id'] as string,
      step_id: proj['current_step_id'] as string,
      count: 0,
      value: 0,
    }
    existing.count += 1
    existing.value += Number(proj['project_value'] ?? 0)
    aggregated.set(key, existing)
  }

  // Upsert snapshots
  let upserted = 0
  for (const entry of aggregated.values()) {
    const { error } = await db
      .from('step_kpi_snapshots')
      .upsert({
        company_id: entry.company_id,
        step_id: entry.step_id,
        snapshot_date: today,
        project_count: entry.count,
        portfolio_value: entry.value,
      }, { onConflict: 'step_id,snapshot_date' })

    if (!error) upserted++
  }

  return NextResponse.json({
    success: true,
    date: today,
    projectsProcessed: (projects ?? []).length,
    snapshotsUpserted: upserted,
  })
}
