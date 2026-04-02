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

const UpdateToolSchema = z.object({
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
  is_active: z.boolean(),
})

export type UpdateToolInput = z.infer<typeof UpdateToolSchema>

export type ToolActionResult = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

// ---------------------------------------------------------------------------
// Update Tool
// ---------------------------------------------------------------------------

export async function updateTool(
  toolId: string,
  input: UpdateToolInput,
): Promise<ToolActionResult> {
  const session = await getSession()
  if (!session) throw new Error('Nicht angemeldet')
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) throw new Error('Kein Zugriff')

  const holdingId = session.holdingId
  if (!holdingId) {
    return { success: false, error: 'Kein Holding zugewiesen.' }
  }

  // Validate
  const parsed = UpdateToolSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? '_root'
      if (!fieldErrors[key]) fieldErrors[key] = []
      fieldErrors[key].push(issue.message)
    }
    return { success: false, fieldErrors }
  }

  const { name, slug, category, base_url, auth_type, secret_ref, docs_url, is_active } = parsed.data

  const serviceClient = createSupabaseServiceClient()

  // Verify ownership
  const { data: existing, error: fetchError } = await serviceClient
    .from('tool_registry')
    .select('id, name, holding_id')
    .eq('id', toolId)
    .eq('holding_id', holdingId)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Tool nicht gefunden.' }
  }

  // Update
  const { error: updateError } = await serviceClient
    .from('tool_registry')
    .update({
      name,
      slug,
      category,
      base_url: base_url || null,
      auth_type,
      secret_ref: secret_ref || null,
      docs_url: docs_url || null,
      is_active,
    })
    .eq('id', toolId)
    .eq('holding_id', holdingId)

  if (updateError) {
    if (updateError.code === '23505') {
      return { success: false, error: `Ein Tool mit dem Slug "${slug}" existiert bereits.` }
    }
    return { success: false, error: 'Fehler beim Aktualisieren. Bitte versuchen Sie es erneut.' }
  }

  // Audit log
  const supabase = createSupabaseServerClient()
  await supabase.from('audit_log').insert({
    holding_id: holdingId,
    actor_id: session.profile.id,
    action: 'tool.updated',
    entity_type: 'tool_registry',
    entity_id: toolId,
    entity_name: name,
    details: { slug, category, auth_type, is_active },
  })

  return { success: true }
}

// ---------------------------------------------------------------------------
// Test Connection
// ---------------------------------------------------------------------------

export type TestConnectionResult = {
  success: boolean
  status: 'connected' | 'error' | 'no_url'
  message: string
  responseTimeMs?: number
}

export async function testConnection(toolId: string): Promise<TestConnectionResult> {
  const session = await getSession()
  if (!session) throw new Error('Nicht angemeldet')
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) throw new Error('Kein Zugriff')

  const holdingId = session.holdingId
  if (!holdingId) {
    return { success: false, status: 'error', message: 'Kein Holding zugewiesen.' }
  }

  const serviceClient = createSupabaseServiceClient()

  // Fetch tool
  const { data: tool, error: fetchError } = await serviceClient
    .from('tool_registry')
    .select('id, name, base_url, auth_type, secret_ref, is_active, holding_id')
    .eq('id', toolId)
    .eq('holding_id', holdingId)
    .single()

  if (fetchError || !tool) {
    return { success: false, status: 'error', message: 'Tool nicht gefunden.' }
  }

  const toolRecord = tool as Record<string, unknown>
  const baseUrl = toolRecord['base_url'] as string | null
  const isActive = toolRecord['is_active'] as boolean

  if (!isActive) {
    return {
      success: false,
      status: 'error',
      message: 'Tool ist deaktiviert. Bitte aktivieren Sie es zuerst.',
    }
  }

  if (!baseUrl) {
    return {
      success: false,
      status: 'no_url',
      message: 'Keine Base-URL konfiguriert. Bitte fuegen Sie eine URL hinzu.',
    }
  }

  // Attempt a simple HEAD/GET request to the base URL
  // In production, this would use proper auth headers from the secret
  const startTime = Date.now()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(baseUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Enura-Platform-ConnectionTest/1.0',
      },
    })

    clearTimeout(timeoutId)
    const responseTimeMs = Date.now() - startTime

    if (response.ok || response.status === 401 || response.status === 403) {
      // 401/403 means the server is reachable but needs auth — that's a success for connectivity
      return {
        success: true,
        status: 'connected',
        message: `Verbindung erfolgreich (${response.status}, ${responseTimeMs}ms)`,
        responseTimeMs,
      }
    }

    return {
      success: false,
      status: 'error',
      message: `Server antwortet mit Status ${response.status} (${responseTimeMs}ms)`,
      responseTimeMs,
    }
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - startTime
    const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler'

    if (errorMessage.includes('abort')) {
      return {
        success: false,
        status: 'error',
        message: `Timeout nach 10 Sekunden (${responseTimeMs}ms)`,
        responseTimeMs,
      }
    }

    return {
      success: false,
      status: 'error',
      message: `Verbindungsfehler: ${errorMessage}`,
      responseTimeMs,
    }
  }
}
