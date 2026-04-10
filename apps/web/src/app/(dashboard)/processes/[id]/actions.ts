'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ActionResult {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const StepEditSchema = z.object({
  stepId: z.string().uuid(),
  description: z.string().max(2000).optional(),
  expected_output: z.string().max(1000).nullable().optional(),
  show_in_flowchart: z.boolean().optional(),
})

const SourceEditSchema = z.object({
  sourceId: z.string().uuid(),
  label: z.string().min(1).max(200).optional(),
  tool_name: z.string().max(200).nullable().optional(),
  endpoint: z.string().max(500).nullable().optional(),
})

const InterfaceEditSchema = z.object({
  interfaceId: z.string().uuid(),
  label: z.string().min(1).max(200).optional(),
  endpoint: z.string().max(500).nullable().optional(),
})

const SaveRedactionalEditsSchema = z.object({
  processId: z.string().uuid(),
  changeNote: z.string().min(1).max(500),
  stepEdits: z.array(StepEditSchema),
  sourceEdits: z.array(SourceEditSchema),
  interfaceEdits: z.array(InterfaceEditSchema),
})

export type SaveRedactionalEditsInput = z.infer<typeof SaveRedactionalEditsSchema>

// ---------------------------------------------------------------------------
// Version bump helper: v1.0 -> v1.1, v2.3 -> v2.4
// ---------------------------------------------------------------------------

function bumpMinorVersion(version: string): string {
  const parts = version.split('.')
  if (parts.length < 2) return `${version}.1`
  const major = parts[0] ?? '1'
  const minor = parseInt(parts[1] ?? '0', 10)
  return `${major}.${minor + 1}`
}

// ---------------------------------------------------------------------------
// saveRedactionalEdits — Super User redactional edits
// ---------------------------------------------------------------------------

export async function saveRedactionalEdits(
  input: SaveRedactionalEditsInput,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Nicht authentifiziert.' }
  }

  // Check: must be super_user or holding admin
  const isSuperUser = session.roles.some((r) => r.key === 'super_user')
  if (!isSuperUser && !session.isHoldingAdmin) {
    return { success: false, error: 'Keine Berechtigung für redaktionelle Bearbeitung.' }
  }

  // Validate input
  const parsed = SaveRedactionalEditsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungültige Eingabedaten.' }
  }

  const { processId, changeNote, stepEdits, sourceEdits, interfaceEdits } = parsed.data

  // Check no edits provided
  if (stepEdits.length === 0 && sourceEdits.length === 0 && interfaceEdits.length === 0) {
    return { success: false, error: 'Keine Änderungen zum Speichern.' }
  }

  const supabase = createSupabaseServerClient()

  // Fetch process definition
  const { data: processDef } = await supabase
    .from('process_definitions')
    .select('id, version, holding_id, company_id, status')
    .eq('id', processId)
    .single()

  if (!processDef) {
    return { success: false, error: 'Prozess nicht gefunden.' }
  }

  const defRow = processDef as Record<string, unknown>

  // Verify process belongs to user's company
  if (
    session.companyId &&
    (defRow['company_id'] as string | null) !== session.companyId
  ) {
    return { success: false, error: 'Keine Berechtigung für diesen Prozess.' }
  }

  // Check holding permission_matrix for process_edit_redactional
  if (session.holdingId) {
    const { data: holding } = await supabase
      .from('holdings')
      .select('permission_matrix')
      .eq('id', session.holdingId)
      .single()

    if (holding) {
      const holdingRow = holding as Record<string, unknown>
      const matrix = holdingRow['permission_matrix'] as Record<string, unknown> | null
      if (matrix && matrix['process_edit_redactional'] === false) {
        return { success: false, error: 'Redaktionelle Bearbeitung ist deaktiviert.' }
      }
    }
  }

  const currentVersion = (defRow['version'] as string) ?? '1.0'
  const newVersion = bumpMinorVersion(currentVersion)

  // Apply step edits
  const stepUpdatePromises = stepEdits.map((edit) => {
    const updates: Record<string, unknown> = {}
    if (edit.description !== undefined) updates['description'] = edit.description
    if (edit.expected_output !== undefined) updates['expected_output'] = edit.expected_output
    if (edit.show_in_flowchart !== undefined) updates['show_in_flowchart'] = edit.show_in_flowchart

    if (Object.keys(updates).length === 0) return Promise.resolve({ error: null })

    return supabase
      .from('process_steps')
      .update(updates)
      .eq('id', edit.stepId)
      .eq('process_id', processId)
  })

  // Apply source edits
  const sourceUpdatePromises = sourceEdits.map((edit) => {
    const updates: Record<string, unknown> = {}
    if (edit.label !== undefined) updates['label'] = edit.label
    if (edit.tool_name !== undefined) updates['tool_name'] = edit.tool_name
    if (edit.endpoint !== undefined) updates['endpoint'] = edit.endpoint

    if (Object.keys(updates).length === 0) return Promise.resolve({ error: null })

    return supabase
      .from('process_step_sources')
      .update(updates)
      .eq('id', edit.sourceId)
  })

  // Apply interface edits
  const interfaceUpdatePromises = interfaceEdits.map((edit) => {
    const updates: Record<string, unknown> = {}
    if (edit.label !== undefined) updates['label'] = edit.label
    if (edit.endpoint !== undefined) updates['endpoint'] = edit.endpoint

    if (Object.keys(updates).length === 0) return Promise.resolve({ error: null })

    return supabase
      .from('process_step_interfaces')
      .update(updates)
      .eq('id', edit.interfaceId)
  })

  // Execute all updates
  const allResults = await Promise.all([
    ...stepUpdatePromises,
    ...sourceUpdatePromises,
    ...interfaceUpdatePromises,
  ])

  const hasError = allResults.some((r) => r.error)
  if (hasError) {
    return { success: false, error: 'Fehler beim Speichern der Änderungen.' }
  }

  // Update version on process_definitions
  const { error: versionUpdateError } = await supabase
    .from('process_definitions')
    .update({
      version: newVersion,
      deployed_version: newVersion,
    })
    .eq('id', processId)

  if (versionUpdateError) {
    return { success: false, error: 'Fehler beim Aktualisieren der Version.' }
  }

  // Create version snapshot
  const holdingId = defRow['holding_id'] as string
  const companyId = defRow['company_id'] as string | null

  await supabase.from('process_versions').insert({
    holding_id: holdingId,
    company_id: companyId,
    process_id: processId,
    version: newVersion,
    snapshot: {
      type: 'redaktionell',
      step_edits: stepEdits,
      source_edits: sourceEdits,
      interface_edits: interfaceEdits,
    },
    change_summary: `Redaktionell (${newVersion}): ${changeNote}`,
    created_by: session.profile.id,
  })

  // Write audit log
  await supabase.from('audit_log').insert({
    company_id: companyId,
    user_id: session.profile.id,
    action: 'process.redactional_edit',
    entity_type: 'process_definition',
    entity_id: processId,
    metadata: {
      previous_version: currentVersion,
      new_version: newVersion,
      change_note: changeNote,
      step_edit_count: stepEdits.length,
      source_edit_count: sourceEdits.length,
      interface_edit_count: interfaceEdits.length,
    },
    created_at: new Date().toISOString(),
  })

  revalidatePath(`/processes/${processId}`)
  return { success: true }
}
