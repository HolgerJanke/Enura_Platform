// =============================================================================
// Activate Liquidity Triggers — Called when a project advances to a new phase.
// Finds trigger instances for the project, sets trigger_activated_at,
// and computes budget_date on the linked event instance.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { LiquidityEventInstanceRow } from '@enura/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriggerActivationResult {
  triggersActivated: number
  eventsScheduled: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function activateLiquidityTriggers(
  supabase: SupabaseClient,
  projectId: string,
  stepId: string,
): Promise<TriggerActivationResult> {
  const result: TriggerActivationResult = {
    triggersActivated: 0,
    eventsScheduled: 0,
    errors: [],
  }

  const now = new Date()
  const nowISO = now.toISOString()

  // Find trigger instances for this project and step that have not yet been activated
  const { data: triggersRaw, error: trigErr } = await supabase
    .from('liquidity_event_instances')
    .select(`
      id, linked_instance_id, plan_delay_days,
      direction, plan_currency, budget_amount
    `)
    .eq('project_id', projectId)
    .eq('step_id', stepId)
    .eq('marker_type', 'trigger')
    .is('trigger_activated_at', null)

  if (trigErr) {
    result.errors.push(`Fehler beim Laden der Trigger-Instanzen: ${trigErr.message}`)
    return result
  }

  const triggers = (triggersRaw ?? []) as unknown as LiquidityEventInstanceRow[]

  for (const trigger of triggers) {
    // Activate the trigger
    const { error: updateTriggerErr } = await supabase
      .from('liquidity_event_instances')
      .update({
        trigger_activated_at: nowISO,
      })
      .eq('id', trigger.id)

    if (updateTriggerErr) {
      result.errors.push(
        `Fehler beim Aktivieren von Trigger ${trigger.id}: ${updateTriggerErr.message}`,
      )
      continue
    }

    result.triggersActivated++

    // Compute budget_date on the linked event instance (if exists)
    if (!trigger.linked_instance_id) continue

    const delayDays = trigger.plan_delay_days ?? 0
    const planDate = new Date(now)
    planDate.setDate(planDate.getDate() + delayDays)
    const planDateStr = planDate.toISOString().split('T')[0]!

    const { error: updateEventErr } = await supabase
      .from('liquidity_event_instances')
      .update({
        budget_date: planDateStr,
        trigger_activated_at: nowISO,
      })
      .eq('id', trigger.linked_instance_id)

    if (updateEventErr) {
      result.errors.push(
        `Fehler beim Setzen des Plan-Datums fuer Ereignis ${trigger.linked_instance_id}: ${updateEventErr.message}`,
      )
      continue
    }

    result.eventsScheduled++
  }

  return result
}
