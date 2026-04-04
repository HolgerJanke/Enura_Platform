import { notFound } from 'next/navigation'
import { requireHoldingAdmin } from '@/lib/permissions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ProcessBuilder } from '@/components/process-builder/ProcessBuilder'
import type {
  ProcessDefinitionRow,
  ProcessStepRow,
  ProcessStepSourceRow,
  ProcessStepInterfaceRow,
  ProcessStepLiquidityRow,
  ToolRegistryRow,
  HoldingSecretRow,
} from '@enura/types'

// ---------------------------------------------------------------------------
// Types for builder data
// ---------------------------------------------------------------------------

export interface ProcessBuilderData {
  definition: ProcessDefinitionRow
  steps: ProcessStepRow[]
  sources: ProcessStepSourceRow[]
  interfaces: ProcessStepInterfaceRow[]
  liquidity: ProcessStepLiquidityRow[]
  toolRegistry: ToolRegistryRow[]
  secrets: Array<{ id: string; name: string }>
}

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function ProcessBuilderPage({
  params,
}: {
  params: { id: string }
}) {
  await requireHoldingAdmin()

  const supabase = createSupabaseServerClient()
  const processId = params.id

  // Fetch all data in parallel
  const [defResult, stepsResult, sourcesResult, interfacesResult, liquidityResult] =
    await Promise.all([
      supabase
        .from('process_definitions')
        .select('*')
        .eq('id', processId)
        .single(),
      supabase
        .from('process_steps')
        .select('*')
        .eq('process_id', processId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('process_step_sources')
        .select('*')
        .eq('process_id', processId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('process_step_interfaces')
        .select('*')
        .eq('process_id', processId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('process_step_liquidity')
        .select('*')
        .eq('process_id', processId),
    ])

  if (defResult.error || !defResult.data) {
    return (<div className="p-8 text-center"><p className="text-gray-500">Nicht gefunden.</p><a href="/" className="text-blue-600 underline">Zurueck</a></div>)
  }

  const definition = defResult.data as ProcessDefinitionRow

  // Fetch tool registry and secrets for the holding
  const [toolsResult, secretsResult] = await Promise.all([
    supabase
      .from('tool_registry')
      .select('*')
      .eq('holding_id', definition.holding_id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('holding_secrets')
      .select('id, name')
      .eq('holding_id', definition.holding_id)
      .eq('is_active', true)
      .order('name'),
  ])

  const builderData: ProcessBuilderData = {
    definition,
    steps: (stepsResult.data ?? []) as ProcessStepRow[],
    sources: (sourcesResult.data ?? []) as ProcessStepSourceRow[],
    interfaces: (interfacesResult.data ?? []) as ProcessStepInterfaceRow[],
    liquidity: (liquidityResult.data ?? []) as ProcessStepLiquidityRow[],
    toolRegistry: (toolsResult.data ?? []) as ToolRegistryRow[],
    secrets: (secretsResult.data ?? []) as Array<{ id: string; name: string }>,
  }

  return (
    <div className="h-full">
      <ProcessBuilder data={builderData} />
    </div>
  )
}
