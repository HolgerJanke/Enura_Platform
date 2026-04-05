'use server'

import { z } from 'zod'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const CATEGORIES = ['verkauf', 'planung', 'abwicklung', 'betrieb', 'sonstige'] as const

const TemplateStepSchema = z.object({
  name: z.string().min(1, 'Schrittname ist erforderlich').max(200),
  description: z.string().max(2000).optional().default(''),
  responsible_roles: z.array(z.string().min(1)).min(1, 'Mindestens eine Rolle angeben'),
  sort_order: z.number().int().min(0),
  process_step_id: z.string().max(50).optional(),
  main_process: z.enum(['vertrieb', 'planung', 'abwicklung', 'service']).nullable().optional(),
  expected_output: z.string().max(500).nullable().optional(),
  typical_hours: z.number().min(0).nullable().optional(),
  warning_days: z.number().int().min(0).nullable().optional(),
  show_in_flowchart: z.boolean().optional().default(true),
  liquidity_marker: z.enum(['trigger', 'event']).nullable().optional(),
})

const TemplateUploadSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(CATEGORIES, {
    errorMap: () => ({
      message: 'Ungueltige Kategorie. Erlaubt: verkauf, planung, abwicklung, betrieb, sonstige',
    }),
  }),
  steps: z.array(TemplateStepSchema).min(1, 'Mindestens ein Schritt erforderlich'),
  version: z.string().max(20).optional().default('1.0.0'),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadTemplateResult {
  success: boolean
  templateName?: string
  error?: string
  fieldErrors?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Security scan
// ---------------------------------------------------------------------------

const BLOCKED_PATTERNS = ['<script', '__proto__', 'javascript:', 'eval(', 'constructor[']

function scanForMaliciousContent(data: unknown): string | null {
  const serialized = JSON.stringify(data).toLowerCase()
  for (const pattern of BLOCKED_PATTERNS) {
    if (serialized.includes(pattern)) {
      return `Unerlaubter Inhalt erkannt: "${pattern}"`
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function uploadTemplateAction(
  data: unknown,
): Promise<UploadTemplateResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Nicht authentifiziert.' }
  }

  // Permission: holding admin OR super_user
  const isSuperUser = session.roles.some((r) => r.key === 'super_user')
  if (!session.isHoldingAdmin && !isSuperUser) {
    return { success: false, error: 'Keine Berechtigung. Nur Holding-Admins und Super User koennen Vorlagen hochladen.' }
  }

  // Security scan
  const maliciousContent = scanForMaliciousContent(data)
  if (maliciousContent) {
    return { success: false, error: maliciousContent }
  }

  // Size check (serialized JSON max 500KB)
  const serialized = JSON.stringify(data)
  if (serialized.length > 500 * 1024) {
    return { success: false, error: 'Die Vorlage ist zu gross (max. 500 KB).' }
  }

  // Validate with Zod
  const parsed = TemplateUploadSchema.safeParse(data)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.')
      fieldErrors[path] = issue.message
    }
    return {
      success: false,
      error: 'Validierung fehlgeschlagen.',
      fieldErrors,
    }
  }

  const { name, description, category, steps, version } = parsed.data

  // Insert into process_templates
  const supabase = createSupabaseServerClient()
  const { error: insertError } = await supabase
    .from('process_templates')
    .insert({
      name,
      description: description ?? null,
      category,
      steps: steps as unknown as Record<string, unknown>[],
      version,
      is_active: true,
      created_by: session.profile.id,
    })

  if (insertError) {
    return {
      success: false,
      error: `Vorlage konnte nicht gespeichert werden: ${insertError.message}`,
    }
  }

  revalidatePath('/admin/processes/templates')
  revalidatePath('/admin/processes/new')

  return { success: true, templateName: name }
}

// ---------------------------------------------------------------------------
// Delete template
// ---------------------------------------------------------------------------

export async function deleteTemplateAction(
  templateId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Nicht authentifiziert.' }
  }

  const isSuperUser = session.roles.some((r) => r.key === 'super_user')
  if (!session.isHoldingAdmin && !isSuperUser) {
    return { success: false, error: 'Keine Berechtigung.' }
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('process_templates')
    .update({ is_active: false })
    .eq('id', templateId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/processes/templates')
  revalidatePath('/admin/processes/new')
  return { success: true }
}
