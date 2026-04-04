import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@enura/types'
import { LiquidityClient } from './liquidity-client'

// ---------------------------------------------------------------------------
// Types used for server-side data loading
// ---------------------------------------------------------------------------

interface LiquidityEventRow {
  id: string
  project_id: string
  step_name: string
  process_step_id: string
  marker_type: string
  direction: string
  plan_currency: string
  plan_amount: string | null
  plan_date: string | null
  actual_date: string | null
  actual_currency: string | null
  actual_amount: string | null
  actual_source: string | null
  amount_deviation: string | null
  date_deviation_days: number | null
  trigger_activated_at: string | null
  notes: string | null
}

interface ProjectInfo {
  id: string
  title: string
}

interface CompanySettingsInfo {
  opening_balance: number
  min_liquidity_threshold: number
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface PageProps {
  params: { companyId: string }
}

export default async function LiquidityCompanyPage({ params }: PageProps) {
  await requirePermission('module:finance:read')
  const session = await getSession()
  if (!session) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)

  const { companyId } = params

  // Verify user has access to this company
  if (!session.isHoldingAdmin && session.companyId !== companyId) {
  return (<div className="p-8 text-center"><a href="/dashboard" className="text-blue-600 underline">Zum Dashboard</a></div>)
  }

  const supabase = createSupabaseServerClient()
  const today = new Date()
  const defaultFrom = new Date(today)
  defaultFrom.setDate(defaultFrom.getDate() - 90)

  const fromStr = defaultFrom.toISOString().split('T')[0]!
  const toStr = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]!

  // Fetch liquidity event instances
  const { data: eventsRaw } = await supabase
    .from('liquidity_event_instances')
    .select(`
      id, project_id, step_name, process_step_id, marker_type, direction,
      plan_currency, plan_amount, plan_date,
      actual_date, actual_currency, actual_amount, actual_source,
      amount_deviation, date_deviation_days, trigger_activated_at, notes
    `)
    .eq('company_id', companyId)
    .eq('marker_type', 'event')
    .gte('plan_date', fromStr)
    .lte('plan_date', toStr)
    .order('plan_date', { ascending: true })

  const events = (eventsRaw ?? []) as unknown as LiquidityEventRow[]

  // Fetch overdue events
  const todayStr = today.toISOString().split('T')[0]!
  const { data: overdueRaw } = await supabase
    .from('liquidity_event_instances')
    .select(`
      id, project_id, step_name, process_step_id, marker_type, direction,
      plan_currency, plan_amount, plan_date,
      actual_date, actual_currency, actual_amount, actual_source,
      amount_deviation, date_deviation_days, trigger_activated_at, notes
    `)
    .eq('company_id', companyId)
    .eq('marker_type', 'event')
    .lt('plan_date', todayStr)
    .is('actual_date', null)
    .order('plan_date', { ascending: true })

  const overdueEvents = (overdueRaw ?? []) as unknown as LiquidityEventRow[]

  // Fetch project titles
  const allProjectIds = [
    ...new Set([
      ...events.map((e) => e.project_id),
      ...overdueEvents.map((e) => e.project_id),
    ]),
  ]

  let projectMap: Record<string, string> = {}
  if (allProjectIds.length > 0) {
    const { data: projectsRaw } = await supabase
      .from('projects')
      .select('id, title')
      .in('id', allProjectIds)

    if (projectsRaw) {
      for (const p of projectsRaw as ProjectInfo[]) {
        projectMap[p.id] = p.title
      }
    }
  }

  // Fetch company settings
  const { data: settingsRaw } = await supabase
    .from('company_settings')
    .select('opening_balance, min_liquidity_threshold')
    .eq('company_id', companyId)
    .maybeSingle()

  const settings: CompanySettingsInfo = settingsRaw
    ? {
        opening_balance: Number((settingsRaw as Record<string, unknown>)['opening_balance'] ?? 0),
        min_liquidity_threshold: Number(
          (settingsRaw as Record<string, unknown>)['min_liquidity_threshold'] ?? 10000,
        ),
      }
    : { opening_balance: 0, min_liquidity_threshold: 10000 }

  // Fetch company name
  const { data: companyRaw } = await supabase
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single()

  const companyName = companyRaw
    ? (companyRaw as Record<string, unknown>)['name'] as string
    : 'Unternehmen'

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-semibold text-brand-text-primary mb-1">
        Liquiditaetsplanung
      </h1>
      <p className="text-sm text-brand-text-secondary mb-6">
        {companyName} &mdash; Stand: {formatDate(today)}
      </p>

      <LiquidityClient
        companyId={companyId}
        events={events}
        overdueEvents={overdueEvents}
        projectMap={projectMap}
        openingBalance={settings.opening_balance}
        minThreshold={settings.min_liquidity_threshold}
      />
    </div>
  )
}
