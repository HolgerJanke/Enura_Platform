'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireHoldingSession() {
  const session = await getSession()
  if (!session || !session.isHoldingAdmin) {
    throw new Error('Nicht autorisiert')
  }
  return session
}

function revalidateProcess(processId: string) {
  revalidatePath(`/admin/processes/${processId}`)
}

/** Generate next PROC-XXX step id */
function generateStepId(existingIds: string[]): string {
  let maxNum = 0
  for (const id of existingIds) {
    const match = id.match(/^PROC-(\d+)$/)
    if (match) {
      const num = parseInt(match[1] ?? '0', 10)
      if (num > maxNum) maxNum = num
    }
  }
  const next = maxNum + 1
  return `PROC-${String(next).padStart(3, '0')}`
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ActionResult {
  success: boolean
  error?: string
  data?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// saveProcessAction — update process_definitions metadata
// ---------------------------------------------------------------------------

const SaveProcessSchema = z.object({
  processId: z.string().uuid(),
  name: z.string().min(1).max(200),
  category: z.enum(['verkauf', 'planung', 'abwicklung', 'betrieb', 'sonstige']),
  menuLabel: z.string().min(1).max(100),
  menuIcon: z.string().max(50),
  visibleRoles: z.array(z.string()),
})

export async function saveProcessAction(input: z.infer<typeof SaveProcessSchema>): Promise<ActionResult> {
  await requireHoldingSession()
  const parsed = SaveProcessSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungültige Eingabe' }
  }

  const { processId, name, category, menuLabel, menuIcon, visibleRoles } = parsed.data
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('process_definitions')
    .update({
      name,
      category,
      menu_label: menuLabel,
      menu_icon: menuIcon,
      visible_roles: visibleRoles,
    })
    .eq('id', processId)

  if (error) {
    return { success: false, error: `Speichern: ${error.message} (Code: ${error.code})` }
  }

  revalidateProcess(processId)
  return { success: true }
}

// ---------------------------------------------------------------------------
// addStepAction — insert new process_steps row
// ---------------------------------------------------------------------------

const AddStepSchema = z.object({
  processId: z.string().uuid(),
  holdingId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  name: z.string().min(1).max(200),
  mainProcess: z.enum(['vertrieb', 'planung', 'abwicklung', 'service']).nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
})

export async function addStepAction(input: z.infer<typeof AddStepSchema>): Promise<ActionResult> {
  await requireHoldingSession()
  const parsed = AddStepSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungültige Eingabe' }
  }

  const { processId, holdingId, companyId, name, mainProcess, sortOrder } = parsed.data
  const supabase = createSupabaseServerClient()

  // Fetch existing step IDs
  const { data: existingSteps } = await supabase
    .from('process_steps')
    .select('process_step_id')
    .eq('process_id', processId)

  const existingIds = ((existingSteps ?? []) as Array<{ process_step_id: string }>).map(
    (s) => s.process_step_id,
  )
  const processStepId = generateStepId(existingIds)

  const { data, error } = await supabase
    .from('process_steps')
    .insert({
      process_id: processId,
      holding_id: holdingId,
      company_id: companyId,
      process_step_id: processStepId,
      name,
      main_process: mainProcess ?? null,
      sort_order: sortOrder,
    })
    .select('*')
    .single()

  if (error) {
    return { success: false, error: `Fehler: ${error.message} (Code: ${error.code})` }
  }

  revalidateProcess(processId)
  return { success: true, data: data as Record<string, unknown> }
}

// ---------------------------------------------------------------------------
// updateStepAction — update a step
// ---------------------------------------------------------------------------

const UpdateStepSchema = z.object({
  stepId: z.string().uuid(),
  processId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  mainProcess: z.enum(['vertrieb', 'planung', 'abwicklung', 'service']).nullable().optional(),
  description: z.string().optional(),
  responsibleRoles: z.array(z.string()).optional(),
  expectedOutput: z.string().nullable().optional(),
  typicalHours: z.number().int().nullable().optional(),
  warningDays: z.number().int().nullable().optional(),
  showInFlowchart: z.boolean().optional(),
  liquidityMarker: z.enum(['trigger', 'event']).nullable().optional(),
})

export async function updateStepAction(input: z.infer<typeof UpdateStepSchema>): Promise<ActionResult> {
  await requireHoldingSession()
  const parsed = UpdateStepSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungültige Eingabe' }
  }

  const { stepId, processId, ...updates } = parsed.data
  const supabase = createSupabaseServerClient()

  const dbUpdates: Record<string, unknown> = {}
  if (updates.name !== undefined) dbUpdates['name'] = updates.name
  if (updates.mainProcess !== undefined) dbUpdates['main_process'] = updates.mainProcess
  if (updates.description !== undefined) dbUpdates['description'] = updates.description
  if (updates.responsibleRoles !== undefined) dbUpdates['responsible_roles'] = updates.responsibleRoles
  if (updates.expectedOutput !== undefined) dbUpdates['expected_output'] = updates.expectedOutput
  if (updates.typicalHours !== undefined) dbUpdates['typical_hours'] = updates.typicalHours
  if (updates.warningDays !== undefined) dbUpdates['warning_days'] = updates.warningDays
  if (updates.showInFlowchart !== undefined) dbUpdates['show_in_flowchart'] = updates.showInFlowchart
  if (updates.liquidityMarker !== undefined) dbUpdates['liquidity_marker'] = updates.liquidityMarker

  if (Object.keys(dbUpdates).length === 0) {
    return { success: true }
  }

  const { error } = await supabase
    .from('process_steps')
    .update(dbUpdates)
    .eq('id', stepId)

  if (error) {
    return { success: false, error: `Schritt-Update: ${error.message} (Code: ${error.code})` }
  }

  revalidateProcess(processId)
  return { success: true }
}

// ---------------------------------------------------------------------------
// deleteStepAction — delete step + cascading data
// ---------------------------------------------------------------------------

export async function deleteStepAction(stepId: string, processId: string): Promise<ActionResult> {
  await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  // Cascading deletes are handled by ON DELETE CASCADE in the schema
  const { error } = await supabase
    .from('process_steps')
    .delete()
    .eq('id', stepId)

  if (error) {
    return { success: false, error: 'Fehler beim Löschen des Schritts.' }
  }

  revalidateProcess(processId)
  return { success: true }
}

// ---------------------------------------------------------------------------
// reorderStepsAction — update sort_order for multiple steps
// ---------------------------------------------------------------------------

const ReorderSchema = z.object({
  processId: z.string().uuid(),
  order: z.array(
    z.object({
      stepId: z.string().uuid(),
      sortOrder: z.number().int().nonnegative(),
    }),
  ),
})

export async function reorderStepsAction(input: z.infer<typeof ReorderSchema>): Promise<ActionResult> {
  await requireHoldingSession()
  const parsed = ReorderSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungültige Eingabe' }
  }

  const { processId, order } = parsed.data
  const supabase = createSupabaseServerClient()

  // Update each step's sort_order
  const updates = order.map((item) =>
    supabase
      .from('process_steps')
      .update({ sort_order: item.sortOrder })
      .eq('id', item.stepId)
      .eq('process_id', processId),
  )

  const results = await Promise.all(updates)
  const hasError = results.some((r) => r.error)

  if (hasError) {
    return { success: false, error: 'Fehler beim Neuordnen der Schritte.' }
  }

  revalidateProcess(processId)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Source actions
// ---------------------------------------------------------------------------

const AddSourceSchema = z.object({
  holdingId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  processId: z.string().uuid(),
  stepId: z.string().uuid(),
  label: z.string().min(1).max(200),
  sourceType: z.string().min(1),
  toolName: z.string().nullable().optional(),
  endpoint: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})

export async function addSourceAction(input: z.infer<typeof AddSourceSchema>): Promise<ActionResult> {
  await requireHoldingSession()
  const parsed = AddSourceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungültige Eingabe' }
  }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('process_step_sources')
    .insert({
      holding_id: parsed.data.holdingId,
      company_id: parsed.data.companyId,
      process_id: parsed.data.processId,
      step_id: parsed.data.stepId,
      label: parsed.data.label,
      source_type: parsed.data.sourceType,
      tool_name: parsed.data.toolName ?? null,
      endpoint: parsed.data.endpoint ?? null,
      description: parsed.data.description ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return { success: false, error: `Quelle: ${error.message} (Code: ${error.code})` }
  }

  revalidateProcess(parsed.data.processId)
  return { success: true, data: data as Record<string, unknown> }
}

const UpdateSourceSchema = z.object({
  sourceId: z.string().uuid(),
  processId: z.string().uuid(),
  label: z.string().min(1).max(200).optional(),
  sourceType: z.string().optional(),
  toolName: z.string().nullable().optional(),
  endpoint: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})

export async function updateSourceAction(input: z.infer<typeof UpdateSourceSchema>): Promise<ActionResult> {
  await requireHoldingSession()
  const parsed = UpdateSourceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungültige Eingabe' }
  }

  const { sourceId, processId, ...updates } = parsed.data
  const supabase = createSupabaseServerClient()

  const dbUpdates: Record<string, unknown> = {}
  if (updates.label !== undefined) dbUpdates['label'] = updates.label
  if (updates.sourceType !== undefined) dbUpdates['source_type'] = updates.sourceType
  if (updates.toolName !== undefined) dbUpdates['tool_name'] = updates.toolName
  if (updates.endpoint !== undefined) dbUpdates['endpoint'] = updates.endpoint
  if (updates.description !== undefined) dbUpdates['description'] = updates.description

  const { error } = await supabase
    .from('process_step_sources')
    .update(dbUpdates)
    .eq('id', sourceId)

  if (error) {
    return { success: false, error: 'Fehler beim Aktualisieren der Quelle.' }
  }

  revalidateProcess(processId)
  return { success: true }
}

export async function deleteSourceAction(sourceId: string, processId: string): Promise<ActionResult> {
  await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('process_step_sources')
    .delete()
    .eq('id', sourceId)

  if (error) {
    return { success: false, error: 'Fehler beim Löschen der Quelle.' }
  }

  revalidateProcess(processId)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Interface actions
// ---------------------------------------------------------------------------

const AddInterfaceSchema = z.object({
  holdingId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  processId: z.string().uuid(),
  stepId: z.string().uuid(),
  label: z.string().min(1).max(200),
  interfaceType: z.string().min(1),
  protocol: z.string().optional(),
  toolRegistryId: z.string().uuid().nullable().optional(),
  endpoint: z.string().nullable().optional(),
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).nullable().optional(),
  requestSchema: z.record(z.unknown()).nullable().optional(),
  responseSchema: z.record(z.unknown()).nullable().optional(),
  fieldMapping: z.array(z.record(z.unknown())).optional(),
  secretRef: z.string().nullable().optional(),
  syncIntervalMin: z.number().int().nullable().optional(),
  triggerCondition: z.string().nullable().optional(),
  retryPolicy: z.string().optional(),
  timeoutSec: z.number().int().optional(),
})

export async function addInterfaceAction(input: z.infer<typeof AddInterfaceSchema>): Promise<ActionResult> {
  await requireHoldingSession()
  const parsed = AddInterfaceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungültige Eingabe' }
  }

  const d = parsed.data
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('process_step_interfaces')
    .insert({
      holding_id: d.holdingId,
      company_id: d.companyId,
      process_id: d.processId,
      step_id: d.stepId,
      label: d.label,
      interface_type: d.interfaceType,
      protocol: d.protocol ?? 'https',
      tool_registry_id: d.toolRegistryId ?? null,
      endpoint: d.endpoint ?? null,
      http_method: d.httpMethod ?? null,
      request_schema: d.requestSchema ?? null,
      response_schema: d.responseSchema ?? null,
      field_mapping: d.fieldMapping ?? [],
      secret_ref: d.secretRef ?? null,
      sync_interval_min: d.syncIntervalMin ?? null,
      trigger_condition: d.triggerCondition ?? null,
      retry_policy: d.retryPolicy ?? 'exponential_3x',
      timeout_sec: d.timeoutSec ?? 30,
    })
    .select('*')
    .single()

  if (error) {
    return { success: false, error: `Schnittstelle: ${error.message} (Code: ${error.code})` }
  }

  revalidateProcess(d.processId)
  return { success: true, data: data as Record<string, unknown> }
}

const UpdateInterfaceSchema = z.object({
  interfaceId: z.string().uuid(),
  processId: z.string().uuid(),
  label: z.string().min(1).max(200).optional(),
  interfaceType: z.string().optional(),
  protocol: z.string().optional(),
  toolRegistryId: z.string().uuid().nullable().optional(),
  endpoint: z.string().nullable().optional(),
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).nullable().optional(),
  requestSchema: z.record(z.unknown()).nullable().optional(),
  responseSchema: z.record(z.unknown()).nullable().optional(),
  fieldMapping: z.array(z.record(z.unknown())).optional(),
  secretRef: z.string().nullable().optional(),
  syncIntervalMin: z.number().int().nullable().optional(),
  triggerCondition: z.string().nullable().optional(),
  retryPolicy: z.string().optional(),
  timeoutSec: z.number().int().optional(),
})

export async function updateInterfaceAction(input: z.infer<typeof UpdateInterfaceSchema>): Promise<ActionResult> {
  await requireHoldingSession()
  const parsed = UpdateInterfaceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungültige Eingabe' }
  }

  const { interfaceId, processId, ...updates } = parsed.data
  const supabase = createSupabaseServerClient()

  const dbUpdates: Record<string, unknown> = {}
  if (updates.label !== undefined) dbUpdates['label'] = updates.label
  if (updates.interfaceType !== undefined) dbUpdates['interface_type'] = updates.interfaceType
  if (updates.protocol !== undefined) dbUpdates['protocol'] = updates.protocol
  if (updates.toolRegistryId !== undefined) dbUpdates['tool_registry_id'] = updates.toolRegistryId
  if (updates.endpoint !== undefined) dbUpdates['endpoint'] = updates.endpoint
  if (updates.httpMethod !== undefined) dbUpdates['http_method'] = updates.httpMethod
  if (updates.requestSchema !== undefined) dbUpdates['request_schema'] = updates.requestSchema
  if (updates.responseSchema !== undefined) dbUpdates['response_schema'] = updates.responseSchema
  if (updates.fieldMapping !== undefined) dbUpdates['field_mapping'] = updates.fieldMapping
  if (updates.secretRef !== undefined) dbUpdates['secret_ref'] = updates.secretRef
  if (updates.syncIntervalMin !== undefined) dbUpdates['sync_interval_min'] = updates.syncIntervalMin
  if (updates.triggerCondition !== undefined) dbUpdates['trigger_condition'] = updates.triggerCondition
  if (updates.retryPolicy !== undefined) dbUpdates['retry_policy'] = updates.retryPolicy
  if (updates.timeoutSec !== undefined) dbUpdates['timeout_sec'] = updates.timeoutSec

  const { error } = await supabase
    .from('process_step_interfaces')
    .update(dbUpdates)
    .eq('id', interfaceId)

  if (error) {
    return { success: false, error: 'Fehler beim Aktualisieren der Schnittstelle.' }
  }

  revalidateProcess(processId)
  return { success: true }
}

export async function deleteInterfaceAction(interfaceId: string, processId: string): Promise<ActionResult> {
  await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('process_step_interfaces')
    .delete()
    .eq('id', interfaceId)

  if (error) {
    return { success: false, error: 'Fehler beim Löschen der Schnittstelle.' }
  }

  revalidateProcess(processId)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Liquidity action
// ---------------------------------------------------------------------------

const UpdateLiquiditySchema = z.object({
  processId: z.string().uuid(),
  stepId: z.string().uuid(),
  holdingId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  markerType: z.enum(['trigger', 'event']),
  direction: z.enum(['income', 'expense']),
  planCurrency: z.string().optional(),
  planAmount: z.string().nullable().optional(),
  amountType: z.enum(['fixed', 'percentage']).optional(),
  planDelayDays: z.number().int().nullable().optional(),
  triggerStepId: z.string().uuid().nullable().optional(),
  sourceTool: z.string().nullable().optional(),
})

export async function updateLiquidityAction(input: z.infer<typeof UpdateLiquiditySchema>): Promise<ActionResult> {
  await requireHoldingSession()
  const parsed = UpdateLiquiditySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungültige Eingabe' }
  }

  const d = parsed.data
  const supabase = createSupabaseServerClient()

  // Upsert: check if liquidity row exists for step
  const { data: existing } = await supabase
    .from('process_step_liquidity')
    .select('id')
    .eq('step_id', d.stepId)
    .maybeSingle()

  const row = {
    holding_id: d.holdingId,
    company_id: d.companyId,
    process_id: d.processId,
    step_id: d.stepId,
    marker_type: d.markerType,
    direction: d.direction,
    plan_currency: d.planCurrency ?? 'CHF',
    plan_amount: d.planAmount ?? null,
    amount_type: d.amountType ?? 'fixed',
    plan_delay_days: d.planDelayDays ?? 0,
    trigger_step_id: d.triggerStepId ?? null,
    source_tool: d.sourceTool ?? null,
  }

  if (existing) {
    const { error } = await supabase
      .from('process_step_liquidity')
      .update(row)
      .eq('id', (existing as { id: string }).id)

    if (error) {
      return { success: false, error: 'Fehler beim Aktualisieren der Liquidität.' }
    }
  } else {
    const { error } = await supabase
      .from('process_step_liquidity')
      .insert(row)

    if (error) {
      return { success: false, error: 'Fehler beim Erstellen der Liquidität.' }
    }
  }

  revalidateProcess(d.processId)
  return { success: true }
}

// ---------------------------------------------------------------------------
// finaliseProcessAction — validate + set status to finalised + snapshot
// ---------------------------------------------------------------------------

export async function finaliseProcessAction(processId: string): Promise<ActionResult> {
  const session = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  // Fetch full process data for snapshot
  const [defResult, stepsResult, sourcesResult, interfacesResult, liquidityResult] =
    await Promise.all([
      supabase.from('process_definitions').select('*').eq('id', processId).single(),
      supabase.from('process_steps').select('*').eq('process_id', processId).order('sort_order'),
      supabase.from('process_step_sources').select('*').eq('process_id', processId),
      supabase.from('process_step_interfaces').select('*').eq('process_id', processId),
      supabase.from('process_step_liquidity').select('*').eq('process_id', processId),
    ])

  if (defResult.error || !defResult.data) {
    return { success: false, error: 'Prozess nicht gefunden.' }
  }

  const definition = defResult.data as Record<string, unknown>
  const steps = (stepsResult.data ?? []) as Array<Record<string, unknown>>

  // Validation: must have at least one step
  if (steps.length === 0) {
    return { success: false, error: 'Der Prozess muss mindestens einen Schritt enthalten.' }
  }

  // Validation: every step must have a name
  const stepsWithoutName = steps.filter((s) => !s['name'])
  if (stepsWithoutName.length > 0) {
    return { success: false, error: 'Alle Schritte müssen einen Namen haben.' }
  }

  const currentVersion = definition['version'] as string
  const snapshot = {
    definition: defResult.data,
    steps: stepsResult.data,
    sources: sourcesResult.data,
    interfaces: interfacesResult.data,
    liquidity: liquidityResult.data,
  }

  // Create version snapshot
  const { error: versionError } = await supabase
    .from('process_versions')
    .insert({
      holding_id: definition['holding_id'] as string,
      company_id: definition['company_id'] as string | null,
      process_id: processId,
      version: currentVersion,
      snapshot,
      change_summary: `Finalisiert als Version ${currentVersion}`,
      created_by: session.profile.id,
    })

  if (versionError) {
    // Version might already exist — that is acceptable
    if (versionError.code !== '23505') {
      return { success: false, error: 'Fehler beim Erstellen des Version-Snapshots.' }
    }
  }

  // Update status
  const { error: updateError } = await supabase
    .from('process_definitions')
    .update({ status: 'finalised' })
    .eq('id', processId)

  if (updateError) {
    return { success: false, error: 'Fehler beim Finalisieren.' }
  }

  revalidateProcess(processId)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Phase CRUD
// ---------------------------------------------------------------------------

export async function createPhaseAction(input: {
  processId: string; holdingId: string; companyId: string | null; name: string; description?: string; color?: string
}): Promise<ActionResult> {
  await requireHoldingSession()
  const supabase = createSupabaseServerClient()
  const { data: existing } = await supabase.from('process_phases').select('sort_order').eq('process_id', input.processId).order('sort_order', { ascending: false }).limit(1)
  const nextOrder = existing?.[0] ? ((existing[0] as Record<string, unknown>)['sort_order'] as number) + 1 : 0
  const { data, error } = await supabase.from('process_phases').insert({
    holding_id: input.holdingId, company_id: input.companyId, process_id: input.processId,
    name: input.name, description: input.description ?? null, color: input.color ?? null, sort_order: nextOrder,
  }).select('*').single()
  if (error) return { success: false, error: `Phase: ${error.message}` }
  revalidateProcess(input.processId)
  return { success: true, data: data as Record<string, unknown> }
}

export async function deletePhaseAction(phaseId: string): Promise<ActionResult> {
  await requireHoldingSession()
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('process_phases').delete().eq('id', phaseId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function assignStepToPhaseAction(stepId: string, phaseId: string | null): Promise<ActionResult> {
  await requireHoldingSession()
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('process_steps').update({ phase_id: phaseId }).eq('id', stepId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
