'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const TOOL_CATEGORIES = [
  'crm',
  'telephony',
  'accounting',
  'calendar',
  'lead_aggregation',
  'messaging',
  'email',
  'storage',
  'analytics',
  'custom',
] as const

const AUTH_TYPES = [
  'api_key',
  'oauth2',
  'service_account',
  'webhook',
  'none',
] as const

const CreateToolSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(100, 'Name darf maximal 100 Zeichen haben'),
  slug: z
    .string()
    .min(1, 'Slug ist erforderlich')
    .max(100, 'Slug darf maximal 100 Zeichen haben')
    .regex(
      /^[a-z][a-z0-9_-]*$/,
      'Slug muss lowercase sein und darf nur Buchstaben, Zahlen, Bindestriche und Unterstriche enthalten',
    ),
  category: z.enum(TOOL_CATEGORIES, {
    errorMap: () => ({ message: 'Bitte waehlen Sie eine Kategorie' }),
  }),
  base_url: z
    .string()
    .url('Bitte geben Sie eine gueltige URL ein')
    .optional()
    .or(z.literal('')),
  auth_type: z.enum(AUTH_TYPES, {
    errorMap: () => ({ message: 'Bitte waehlen Sie einen Auth-Typ' }),
  }),
  secret_ref: z.string().max(200).optional().or(z.literal('')),
  docs_url: z
    .string()
    .url('Bitte geben Sie eine gueltige URL ein')
    .optional()
    .or(z.literal('')),
})

export type CreateToolInput = z.infer<typeof CreateToolSchema>

export type CreateToolResult = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function createTool(input: CreateToolInput): Promise<CreateToolResult> {
  // 1. Auth check
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) redirect('/login')

  const holdingId = session.holdingId
  if (!holdingId) {
    return { success: false, error: 'Kein Holding zugewiesen.' }
  }

  // 2. Validate input
  const parsed = CreateToolSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? '_root'
      if (!fieldErrors[key]) fieldErrors[key] = []
      fieldErrors[key].push(issue.message)
    }
    return { success: false, fieldErrors }
  }

  const { name, slug, category, base_url, auth_type, secret_ref, docs_url } = parsed.data

  // 3. Insert tool_registry row
  const serviceClient = createSupabaseServiceClient()

  const { error: insertError } = await serviceClient
    .from('tool_registry')
    .insert({
      holding_id: holdingId,
      name,
      slug,
      category,
      base_url: base_url || null,
      auth_type,
      secret_ref: secret_ref || null,
      docs_url: docs_url || null,
      is_active: true,
      created_by: session.profile.id,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: `Ein Tool mit dem Slug "${slug}" existiert bereits.` }
    }
    return { success: false, error: 'Fehler beim Speichern des Tools. Bitte versuchen Sie es erneut.' }
  }

  // 4. Write audit log
  const supabase = createSupabaseServerClient()
  await supabase.from('audit_log').insert({
    holding_id: holdingId,
    actor_id: session.profile.id,
    action: 'tool.created',
    entity_type: 'tool_registry',
    entity_name: name,
    details: { slug, category, auth_type },
  })

  return { success: true }
}
