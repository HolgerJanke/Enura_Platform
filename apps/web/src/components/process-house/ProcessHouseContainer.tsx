import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { ProcessHouseClientWrapper } from './ProcessHouseClientWrapper'

interface ProcessRow {
  id: string
  name: string
  menu_label: string
  process_type: string | null
  house_sort_order: number
  status: string
  visible_roles: string[]
}

export async function ProcessHouseContainer({ openProcess, openPhase }: { openProcess?: string; openPhase?: string } = {}) {
  const session = await getSession()
  if (!session?.companyId) return null

  const supabase = createSupabaseServerClient()

  const { data } = await supabase
    .from('process_definitions')
    .select('id, name, menu_label, process_type, house_sort_order, status, visible_roles')
    .eq('company_id', session.companyId)
    .eq('status', 'deployed')
    .not('process_type', 'is', null)
    .order('house_sort_order')

  const processes = (data ?? []) as ProcessRow[]

  // Filter by visible_roles
  const userRoleKeys = session.roles.map((r) => r.key)
  const visible = processes.filter((p) => {
    if (session.isHoldingAdmin || session.isEnuraAdmin) return true
    if (p.visible_roles.length === 0) return true
    return p.visible_roles.some((r) => userRoleKeys.includes(r))
  })

  // Fetch phases + steps + currency in parallel (all independent queries)
  const serviceDb = createSupabaseServiceClient()
  const processIds = visible.map((p) => p.id)
  const pProcessIds = visible.filter(p => p.process_type === 'P').map(p => p.id)

  const [phasesRes, stepsRes, currRes, instancesRes, snapshotRes] = await Promise.all([
    processIds.length > 0
      ? serviceDb.from('process_phases').select('id, name, process_id, sort_order').in('process_id', processIds).order('sort_order')
      : Promise.resolve({ data: [] }),
    processIds.length > 0
      ? serviceDb.from('process_steps').select('id, name, process_id, expected_output, sort_order, phase_id').in('process_id', processIds).order('sort_order')
      : Promise.resolve({ data: [] }),
    serviceDb.from('company_currency_settings').select('base_currency').eq('company_id', session.companyId).single(),
    pProcessIds.length > 0
      ? serviceDb.from('project_process_instances').select('project_id, process_id').in('process_id', pProcessIds).eq('status', 'active')
      : Promise.resolve({ data: [] }),
    serviceDb.from('step_kpi_snapshots').select('step_id, project_count, portfolio_value, snapshot_date').eq('company_id', session.companyId),
  ])

  const phasesData = phasesRes.data
  const stepsData = stepsRes.data

  const phasesByProcess = new Map<string, Array<{ id: string; name: string; sortOrder: number; link: string | null }>>()
  for (const ph of (phasesData ?? []) as Array<{ id: string; name: string; process_id: string; sort_order: number }>) {
    const arr = phasesByProcess.get(ph.process_id) ?? []
    arr.push({ id: ph.id, name: ph.name, sortOrder: ph.sort_order, link: null })
    phasesByProcess.set(ph.process_id, arr)
  }

  const linkedPageByProcess = new Map<string, string>()
  const stepsByProcess = new Map<string, Array<{ id: string; name: string; sortOrder: number; link: string | null }>>()

  for (const step of (stepsData ?? []) as Array<{ id: string; name: string; process_id: string; expected_output: string | null; sort_order: number }>) {
    // First step with a link becomes the process linkedPage
    if (step.expected_output?.startsWith('/') && !linkedPageByProcess.has(step.process_id)) {
      linkedPageByProcess.set(step.process_id, step.expected_output)
    }
    // Collect all steps per process
    const arr = stepsByProcess.get(step.process_id) ?? []
    arr.push({ id: step.id, name: step.name, sortOrder: step.sort_order, link: step.expected_output })
    stepsByProcess.set(step.process_id, arr)
  }

  const toItem = (p: ProcessRow) => {
    // For S-type processes: use steps as sub-items (with links) instead of phases
    const isSupport = p.process_type === 'S'
    const phases = isSupport
      ? (stepsByProcess.get(p.id) ?? [])
      : (phasesByProcess.get(p.id) ?? [])

    return {
      id: p.id,
      name: p.name,
      menuLabel: p.menu_label,
      houseSortOrder: p.house_sort_order,
      status: p.status,
      phases,
      linkedPage: isSupport ? null : (linkedPageByProcess.get(p.id) ?? null),
    }
  }

  // Use pre-fetched instance data to compute project counts per step
  const projectCountsByStep = new Map<string, { count: number; value: number }>()

  const instanceProjectIds = [...new Set((instancesRes.data ?? []).map((r: Record<string, unknown>) => r['project_id'] as string))]
  if (instanceProjectIds.length > 0) {
    const { data: projData } = await serviceDb
      .from('projects')
      .select('id, current_step_id, project_value')
      .in('id', instanceProjectIds)
      .eq('status', 'active')

    for (const proj of (projData ?? []) as Array<Record<string, unknown>>) {
      const stepId = proj['current_step_id'] as string | null
      if (!stepId) continue
      const existing = projectCountsByStep.get(stepId) ?? { count: 0, value: 0 }
      existing.count += 1
      existing.value += Number(proj['project_value'] ?? 0)
      projectCountsByStep.set(stepId, existing)
    }
  }

  // Use pre-fetched snapshot data for trend comparison
  const lastMonthDate = new Date()
  lastMonthDate.setDate(lastMonthDate.getDate() - 30)
  const lastMonthStr = lastMonthDate.toISOString().split('T')[0]!

  const lastMonthByStep = new Map<string, { count: number; value: number }>()
  for (const row of ((snapshotRes.data ?? []) as Array<Record<string, unknown>>)) {
    if ((row['snapshot_date'] as string) === lastMonthStr) {
      lastMonthByStep.set(row['step_id'] as string, {
        count: Number(row['project_count'] ?? 0),
        value: Number(row['portfolio_value'] ?? 0),
      })
    }
  }

  // Build toItem with phase KPIs for P-processes
  const toItemWithKpis = (p: ProcessRow) => {
    const item = toItem(p)
    if (p.process_type !== 'P') return item

    // Enrich phases with In/Out counts and portfolio values
    const enrichedPhases = item.phases.map(phase => {
      const phaseId = phase.id
      // Find steps in this phase sorted by sort_order
      const phaseStepIds = (stepsData ?? [])
        .filter((s: Record<string, unknown>) => (s as { process_id: string; phase_id: string | null })['phase_id'] === phaseId && (s as { process_id: string })['process_id'] === p.id)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a['sort_order'] ?? 0) - Number(b['sort_order'] ?? 0))
        .map((s: Record<string, unknown>) => s['id'] as string)

      if (phaseStepIds.length === 0) return phase

      const firstStepData = projectCountsByStep.get(phaseStepIds[0]!) ?? { count: 0, value: 0 }
      const lastStepData = projectCountsByStep.get(phaseStepIds[phaseStepIds.length - 1]!) ?? { count: 0, value: 0 }

      // Portfolio value = sum of all projects in all steps of this phase
      let portfolioValue = 0
      for (const sid of phaseStepIds) {
        portfolioValue += (projectCountsByStep.get(sid) ?? { count: 0, value: 0 }).value
      }

      // Last month data for trends
      const lastMonthFirstStep = lastMonthByStep.get(phaseStepIds[0]!) ?? { count: 0, value: 0 }
      const lastMonthLastStep = lastMonthByStep.get(phaseStepIds[phaseStepIds.length - 1]!) ?? { count: 0, value: 0 }
      const inTrend = firstStepData.count > lastMonthFirstStep.count ? 'up' : firstStepData.count < lastMonthFirstStep.count ? 'down' : 'same'
      const outTrend = lastStepData.count > lastMonthLastStep.count ? 'up' : lastStepData.count < lastMonthLastStep.count ? 'down' : 'same'

      return {
        ...phase,
        inCount: firstStepData.count,
        outCount: lastStepData.count,
        portfolioValue,
        inTrend: inTrend as 'up' | 'down' | 'same',
        outTrend: outTrend as 'up' | 'down' | 'same',
      }
    })

    return { ...item, phases: enrichedPhases }
  }

  const management = visible.filter((p) => p.process_type === 'M').map(toItem)
  const primary = visible.filter((p) => p.process_type === 'P').map(toItemWithKpis)
  const support = visible.filter((p) => p.process_type === 'S').map(toItem)

  if (management.length === 0 && primary.length === 0 && support.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-500 mb-1">Noch kein Prozesshaus konfiguriert.</p>
        <p className="text-xs text-gray-400">Weisen Sie Prozessen einen Typ (M/P/S) zu, um das Prozesshaus zu erstellen.</p>
      </div>
    )
  }

  // Use pre-fetched currency
  const companyCurrency = (currRes.data as Record<string, unknown> | null)?.['base_currency'] as string ?? 'CHF'

  return (
    <ProcessHouseClientWrapper
      management={management}
      primary={primary}
      support={support}
      currency={companyCurrency}
      openProcess={openProcess}
      openPhase={openPhase}
    />
  )
}
