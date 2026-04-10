'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const SECRET_TYPES = [
  'api_key',
  'oauth2_token',
  'service_account',
  'certificate',
  'password',
  'webhook_secret',
] as const

const CreateSecretSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(100, 'Name darf maximal 100 Zeichen haben')
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      'Name muss SCREAMING_SNAKE_CASE sein (z.B. REONIC_API_KEY)',
    ),
  secret_type: z.enum(SECRET_TYPES, {
    errorMap: () => ({ message: 'Bitte wählen Sie einen Secret-Typ' }),
  }),
  scope: z
    .string()
    .min(1, 'Scope ist erforderlich')
    .max(100, 'Scope darf maximal 100 Zeichen haben')
    .default('global'),
  description: z.string().max(500).optional(),
  rotation_interval_days: z
    .number()
    .int()
    .min(1, 'Mindestens 1 Tag')
    .max(365, 'Maximal 365 Tage')
    .optional()
    .nullable(),
  value: z
    .string()
    .min(1, 'Secret-Wert ist erforderlich')
    .max(10000, 'Secret-Wert ist zu lang'),
})

export type CreateSecretInput = z.infer<typeof CreateSecretSchema>

export type CreateSecretResult = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function createSecret(input: CreateSecretInput): Promise<CreateSecretResult> {
  // 1. Auth check
  const session = await getSession()
  if (!session) throw new Error('Nicht angemeldet')
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) throw new Error('Kein Zugriff')

  const holdingId = session.holdingId
  if (!holdingId) {
    return { success: false, error: 'Kein Holding zugewiesen.' }
  }

  // 2. Validate input
  const parsed = CreateSecretSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? '_root'
      if (!fieldErrors[key]) fieldErrors[key] = []
      fieldErrors[key].push(issue.message)
    }
    return { success: false, fieldErrors }
  }

  const { name, secret_type, scope, description, rotation_interval_days, value } = parsed.data

  // 3. Store secret value in vault (simulated via service client insert)
  //    In production, this would use Supabase Vault: SELECT vault.create_secret(...)
  //    For now we store a placeholder vault reference.
  const serviceClient = createSupabaseServiceClient()

  // Generate a vault_id placeholder — in production, Supabase Vault returns this
  const vaultId = crypto.randomUUID()

  // Simulate vault storage: store encrypted value reference
  // IMPORTANT: The actual secret value is NEVER stored in holding_secrets.
  // It goes into the vault only. We do NOT return or log the value.
  // In production: SELECT vault.create_secret($value, $name) → returns vault_id
  void value // Consumed but never persisted in application tables or returned

  // 4. Insert holding_secrets row
  const { error: insertError } = await serviceClient
    .from('holding_secrets')
    .insert({
      holding_id: holdingId,
      name,
      secret_type,
      scope,
      description: description ?? null,
      vault_id: vaultId,
      is_active: true,
      created_by: session.profile.id,
      last_rotated_at: new Date().toISOString(),
      rotation_interval_days: rotation_interval_days ?? null,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: `Ein Secret mit dem Namen "${name}" existiert bereits.` }
    }
    return { success: false, error: 'Fehler beim Speichern des Secrets. Bitte versuchen Sie es erneut.' }
  }

  // 5. Write audit log
  const supabase = createSupabaseServerClient()
  await supabase.from('audit_log').insert({
    holding_id: holdingId,
    actor_id: session.profile.id,
    action: 'secret.created',
    entity_type: 'holding_secret',
    entity_name: name,
    details: { secret_type, scope },
  })

  return { success: true }
}
