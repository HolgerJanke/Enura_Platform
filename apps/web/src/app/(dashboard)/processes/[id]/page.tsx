import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ProcessDetailClient } from './process-detail-client'

// ---------------------------------------------------------------------------
// Types (shared with client component)
// ---------------------------------------------------------------------------

export interface ProcessSourceData {
  id: string
  step_id: string
  label: string
  source_type: string
  tool_name: string | null
  endpoint: string | null
  description: string | null
}

export interface ProcessInterfaceData {
  id: string
  step_id: string
  label: string
  interface_type: string
  protocol: string
  endpoint: string | null
  tool_registry_id: string | null
}

export interface ProcessLiquidityData {
  step_id: string
  plan_amount: number | null
  plan_currency: string
  direction: string
  marker_type: string
}

export interface EnrichedStep {
  id: string
  process_step_id: string
  name: string
  main_process: string | null
  description: string | null
  expected_output: string | null
  responsible_roles: string[]
  show_in_flowchart: boolean
  liquidity_marker: string | null
  sort_order: number
  sources: ProcessSourceData[]
  interfaces: ProcessInterfaceData[]
  liquidity: ProcessLiquidityData | null
}

export interface ProcessPageData {
  id: string
  name: string
  description: string | null
  deployedVersion: string | null
  holdingId: string
  companyId: string | null
}

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------

export default async function TenantProcessPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSession()
  if (!session) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)

  const supabase = createSupabaseServerClient()
  const processId = params.id

  // Fetch the process definition -- must be deployed and belong to user's company
  const { data: process } = await supabase
    .from('process_definitions')
    .select(
      'id, name, description, status, visible_roles, company_id, deployed_version, holding_id',
    )
    .eq('id', processId)
    .eq('status', 'deployed')
    .single()

  if (!process) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            Dieser Prozess wurde nicht gefunden oder ist nicht verfuegbar.
          </p>
        </div>
      </div>
    )
  }

  const processRow = process as Record<string, unknown>

  // Guard: process must belong to user's company
  if (
    session.companyId &&
    (processRow['company_id'] as string | null) !== session.companyId
  ) {
  return (<div className="p-8 text-center"><a href="/dashboard" className="text-blue-600 underline">Zum Dashboard</a></div>)
  }

  // Guard: user's role must be in visible_roles (holding admins bypass)
  const visibleRoles = (processRow['visible_roles'] as string[]) ?? []
  if (!session.isHoldingAdmin && visibleRoles.length > 0) {
    const userRoleKeys = session.roles.map((r) => r.key)
    const hasVisibleRole = visibleRoles.some((vr) =>
      userRoleKeys.includes(vr),
    )
    if (!hasVisibleRole) {
  return (<div className="p-8 text-center"><a href="/dashboard" className="text-blue-600 underline">Zum Dashboard</a></div>)
    }
  }

  // Check if user is super_user (for edit mode)
  const isSuperUser = session.roles.some((r) => r.key === 'super_user')
  const canEdit = isSuperUser || session.isHoldingAdmin

  // Fetch steps
  const { data: stepsData } = await supabase
    .from('process_steps')
    .select(
      'id, process_step_id, name, main_process, description, expected_output, responsible_roles, show_in_flowchart, liquidity_marker, sort_order',
    )
    .eq('process_id', processId)
    .order('sort_order')

  const steps = (
    (stepsData ?? []) as Record<string, unknown>[]
  ).map((s) => ({
    id: s['id'] as string,
    process_step_id: s['process_step_id'] as string,
    name: s['name'] as string,
    main_process: (s['main_process'] as string | null) ?? null,
    description: (s['description'] as string | null) ?? null,
    expected_output: (s['expected_output'] as string | null) ?? null,
    responsible_roles: (s['responsible_roles'] as string[]) ?? [],
    show_in_flowchart: (s['show_in_flowchart'] as boolean) ?? true,
    liquidity_marker: (s['liquidity_marker'] as string | null) ?? null,
    sort_order: (s['sort_order'] as number) ?? 0,
  }))

  const stepIds = steps.map((s) => s.id)

  // Fetch sources, interfaces, and liquidity in parallel
  const [sourcesResult, interfacesResult, liquidityResult] = await Promise.all([
    stepIds.length > 0
      ? supabase
          .from('process_step_sources')
          .select('id, step_id, label, source_type, tool_name, endpoint, description')
          .in('step_id', stepIds)
          .order('sort_order')
      : Promise.resolve({ data: [] }),
    stepIds.length > 0
      ? supabase
          .from('process_step_interfaces')
          .select('id, step_id, label, interface_type, protocol, endpoint, tool_registry_id')
          .in('step_id', stepIds)
          .order('sort_order')
      : Promise.resolve({ data: [] }),
    stepIds.length > 0
      ? supabase
          .from('process_step_liquidity')
          .select('step_id, plan_amount, plan_currency, direction, marker_type')
          .in('step_id', stepIds)
      : Promise.resolve({ data: [] }),
  ])

  const sources: ProcessSourceData[] = (
    (sourcesResult.data ?? []) as Record<string, unknown>[]
  ).map((s) => ({
    id: s['id'] as string,
    step_id: s['step_id'] as string,
    label: s['label'] as string,
    source_type: s['source_type'] as string,
    tool_name: (s['tool_name'] as string | null) ?? null,
    endpoint: (s['endpoint'] as string | null) ?? null,
    description: (s['description'] as string | null) ?? null,
  }))

  const interfaces: ProcessInterfaceData[] = (
    (interfacesResult.data ?? []) as Record<string, unknown>[]
  ).map((i) => ({
    id: i['id'] as string,
    step_id: i['step_id'] as string,
    label: i['label'] as string,
    interface_type: i['interface_type'] as string,
    protocol: (i['protocol'] as string) ?? 'rest',
    endpoint: (i['endpoint'] as string | null) ?? null,
    tool_registry_id: (i['tool_registry_id'] as string | null) ?? null,
  }))

  const liquidity: ProcessLiquidityData[] = (
    (liquidityResult.data ?? []) as Record<string, unknown>[]
  ).map((l) => ({
    step_id: l['step_id'] as string,
    plan_amount: (l['plan_amount'] as number | null) ?? null,
    plan_currency: (l['plan_currency'] as string) ?? 'CHF',
    direction: l['direction'] as string,
    marker_type: l['marker_type'] as string,
  }))

  // Build enriched steps for client
  const enrichedSteps: EnrichedStep[] = steps.map((step) => ({
    ...step,
    sources: sources.filter((s) => s.step_id === step.id),
    interfaces: interfaces.filter((i) => i.step_id === step.id),
    liquidity: liquidity.find((l) => l.step_id === step.id) ?? null,
  }))

  const processData: ProcessPageData = {
    id: processRow['id'] as string,
    name: processRow['name'] as string,
    description: (processRow['description'] as string | null) ?? null,
    deployedVersion: (processRow['deployed_version'] as string | null) ?? null,
    holdingId: processRow['holding_id'] as string,
    companyId: (processRow['company_id'] as string | null) ?? null,
  }

  return (
    <div className="p-6">
      <ProcessDetailClient
        process={processData}
        steps={enrichedSteps}
        canEdit={canEdit}
      />
    </div>
  )
}
