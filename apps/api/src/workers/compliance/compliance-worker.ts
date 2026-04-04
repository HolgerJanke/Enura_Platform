// =============================================================================
// Compliance Worker — Evaluates compliance rules against trigger events
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComplianceRule {
  id: string
  rule_code: string
  title: string
  trigger_event: string
  trigger_filter: Record<string, unknown>
  deadline_days: number
  severity: string
  is_active: boolean
}

interface ComplianceCheckContext {
  holdingId: string
  companyId?: string
  triggerEvent: string
  triggeredBy?: string
  payload: Record<string, unknown>
}

interface ProcessResult {
  created: number
  skipped: number
  errors: string[]
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
// matchesFilter — checks if context payload satisfies the rule's trigger_filter
//
// Every key in the filter must exist in the payload with matching value.
// An empty filter always matches.
// ---------------------------------------------------------------------------

export function matchesFilter(
  filter: Record<string, unknown>,
  payload: Record<string, unknown>,
): boolean {
  const keys = Object.keys(filter)
  if (keys.length === 0) return true

  for (const key of keys) {
    const filterValue = filter[key]
    const payloadValue = payload[key]

    // Array filter: payload value must be included in the array
    if (Array.isArray(filterValue)) {
      if (!filterValue.includes(payloadValue)) return false
      continue
    }

    // Primitive comparison
    if (payloadValue !== filterValue) return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Deduplicate key — prevent duplicate checks for same rule on same day
// ---------------------------------------------------------------------------

function deduplicationKey(ruleId: string, holdingId: string, companyId: string | undefined): string {
  return `${ruleId}::${holdingId}::${companyId ?? 'holding'}`
}

// ---------------------------------------------------------------------------
// processComplianceCheck — main entry point
//
// Loads active rules matching the trigger_event, filters by trigger_filter,
// deduplicates by date, and inserts compliance_checks.
// ---------------------------------------------------------------------------

export async function processComplianceCheck(
  context: ComplianceCheckContext,
): Promise<ProcessResult> {
  const client = getServiceClient()
  const result: ProcessResult = { created: 0, skipped: 0, errors: [] }

  // 1. Load active rules for this trigger event
  const { data: rules, error: rulesError } = await client
    .from('compliance_rules')
    .select('id, rule_code, title, trigger_event, trigger_filter, deadline_days, severity, is_active')
    .eq('trigger_event', context.triggerEvent)
    .eq('is_active', true)

  if (rulesError) {
    result.errors.push(`Fehler beim Laden der Regeln: ${rulesError.message}`)
    return result
  }

  const matchingRules = (rules ?? []) as unknown as ComplianceRule[]

  // 2. Filter rules whose trigger_filter matches the context payload
  const applicableRules = matchingRules.filter((rule) =>
    matchesFilter(rule.trigger_filter as Record<string, unknown>, context.payload),
  )

  if (applicableRules.length === 0) {
    return result
  }

  // 3. Fetch existing open checks for today to deduplicate
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: existingChecks } = await client
    .from('compliance_checks')
    .select('id, rule_id, holding_id, company_id')
    .eq('holding_id', context.holdingId)
    .in('status', ['open', 'fulfilled'])
    .gte('triggered_at', todayStart.toISOString())

  const existingKeys = new Set<string>()
  for (const check of (existingChecks ?? []) as Record<string, unknown>[]) {
    const key = deduplicationKey(
      check['rule_id'] as string,
      check['holding_id'] as string,
      (check['company_id'] as string | null) ?? undefined,
    )
    existingKeys.add(key)
  }

  // 4. Insert new compliance checks
  for (const rule of applicableRules) {
    const key = deduplicationKey(rule.id, context.holdingId, context.companyId)

    if (existingKeys.has(key)) {
      result.skipped++
      continue
    }

    const dueAt = new Date()
    dueAt.setDate(dueAt.getDate() + rule.deadline_days)

    const { error: insertError } = await client
      .from('compliance_checks')
      .insert({
        holding_id: context.holdingId,
        company_id: context.companyId ?? null,
        rule_id: rule.id,
        rule_code: rule.rule_code,
        status: 'open',
        triggered_by: context.triggeredBy ?? 'system',
        triggered_at: new Date().toISOString(),
        due_at: dueAt.toISOString(),
      })

    if (insertError) {
      result.errors.push(`Regel ${rule.rule_code}: ${insertError.message}`)
    } else {
      result.created++
    }
  }

  return result
}
