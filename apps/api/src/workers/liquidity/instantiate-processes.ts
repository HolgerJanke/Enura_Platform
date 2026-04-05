// =============================================================================
// Process Instantiation — Creates project_process_instances and
// liquidity_event_instances for each liquidity step in deployed processes.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ProcessDefinitionRow,
  ProcessStepRow,
  ProcessStepLiquidityRow,
} from '@enura/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstantiationResult {
  instancesCreated: number
  eventsCreated: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function instantiateProcessesForProject(
  supabase: SupabaseClient,
  projectId: string,
  companyId: string,
  holdingId: string,
): Promise<InstantiationResult> {
  const result: InstantiationResult = {
    instancesCreated: 0,
    eventsCreated: 0,
    errors: [],
  }

  // Find deployed process definitions for this company that have liquidity markers
  const { data: processesRaw, error: procErr } = await supabase
    .from('process_definitions')
    .select('id, name, version, deployed_version')
    .eq('company_id', companyId)
    .eq('status', 'deployed')

  if (procErr) {
    result.errors.push(`Fehler beim Laden der Prozessdefinitionen: ${procErr.message}`)
    return result
  }

  const processes = (processesRaw ?? []) as unknown as ProcessDefinitionRow[]

  for (const process of processes) {
    // Check if this process has any liquidity steps
    const { data: stepsRaw, error: stepErr } = await supabase
      .from('process_steps')
      .select('id, process_step_id, name, sort_order, liquidity_marker')
      .eq('process_id', process.id)
      .not('liquidity_marker', 'is', null)
      .order('sort_order', { ascending: true })

    if (stepErr) {
      result.errors.push(`Fehler bei Prozess ${process.name}: ${stepErr.message}`)
      continue
    }

    const liquiditySteps = (stepsRaw ?? []) as unknown as ProcessStepRow[]
    if (liquiditySteps.length === 0) continue

    // Check if instance already exists for this project + process
    const { data: existingInstance } = await supabase
      .from('project_process_instances')
      .select('id')
      .eq('project_id', projectId)
      .eq('process_id', process.id)
      .maybeSingle()

    if (existingInstance) continue // Already instantiated

    // Create the process instance
    const { data: newInstance, error: instErr } = await supabase
      .from('project_process_instances')
      .insert({
        holding_id: holdingId,
        company_id: companyId,
        project_id: projectId,
        process_id: process.id,
        process_version: process.deployed_version ?? process.version,
        status: 'active',
      })
      .select('id')
      .single()

    if (instErr || !newInstance) {
      result.errors.push(
        `Fehler beim Erstellen der Prozessinstanz fuer ${process.name}: ${instErr?.message ?? 'unbekannt'}`,
      )
      continue
    }

    const instanceId = (newInstance as Record<string, unknown>)['id'] as string
    result.instancesCreated++

    // Fetch liquidity metadata for each step
    const stepIds = liquiditySteps.map((s) => s.id)
    const { data: liquidityDataRaw, error: liqErr } = await supabase
      .from('process_step_liquidity')
      .select(`
        id, step_id, marker_type, trigger_step_id, event_step_id,
        direction, plan_currency, plan_amount, amount_type,
        plan_delay_days, source_tool
      `)
      .eq('process_id', process.id)
      .in('step_id', stepIds)

    if (liqErr) {
      result.errors.push(
        `Fehler beim Laden der Liquiditaetsdaten fuer ${process.name}: ${liqErr.message}`,
      )
      continue
    }

    const liquidityData = (liquidityDataRaw ?? []) as unknown as ProcessStepLiquidityRow[]

    // Create a mapping from step_id to step row for quick lookup
    const stepMap = new Map<string, ProcessStepRow>()
    for (const step of liquiditySteps) {
      stepMap.set(step.id, step)
    }

    // Create a mapping from liquidity entry id to created instance id (for linking triggers to events)
    const createdEventMap = new Map<string, string>()

    // First pass: create all event instances
    for (const liq of liquidityData) {
      const step = stepMap.get(liq.step_id)
      if (!step) continue

      const { data: eventInstance, error: evtErr } = await supabase
        .from('liquidity_event_instances')
        .insert({
          holding_id: holdingId,
          company_id: companyId,
          instance_id: instanceId,
          project_id: projectId,
          process_id: process.id,
          step_id: liq.step_id,
          process_step_id: step.process_step_id,
          step_name: step.name,
          marker_type: liq.marker_type,
          direction: liq.direction,
          plan_currency: liq.plan_currency,
          budget_amount: liq.plan_amount,
          amount_type: liq.amount_type,
          plan_delay_days: liq.plan_delay_days ?? 0,
        })
        .select('id')
        .single()

      if (evtErr) {
        result.errors.push(
          `Fehler beim Erstellen des Liquiditaetsereignisses fuer Schritt "${step.name}": ${evtErr.message}`,
        )
        continue
      }

      const eventId = (eventInstance as Record<string, unknown>)['id'] as string
      createdEventMap.set(liq.id, eventId)
      result.eventsCreated++
    }

    // Second pass: link trigger instances to their associated event instances
    for (const liq of liquidityData) {
      if (liq.marker_type !== 'trigger' || !liq.event_step_id) continue

      const triggerId = createdEventMap.get(liq.id)
      if (!triggerId) continue

      // Find the event instance that corresponds to the event_step_id
      const linkedLiq = liquidityData.find(
        (l) => l.step_id === liq.event_step_id && l.marker_type === 'event',
      )
      if (!linkedLiq) continue

      const linkedEventId = createdEventMap.get(linkedLiq.id)
      if (!linkedEventId) continue

      await supabase
        .from('liquidity_event_instances')
        .update({ linked_instance_id: linkedEventId })
        .eq('id', triggerId)
    }
  }

  return result
}
