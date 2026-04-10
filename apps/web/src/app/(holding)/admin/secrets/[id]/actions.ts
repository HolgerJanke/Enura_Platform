'use server'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecretActionResult = {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Rotate Secret
// ---------------------------------------------------------------------------

export async function rotateSecret(
  secretId: string,
  newValue: string,
): Promise<SecretActionResult> {
  const session = await getSession()
  if (!session) throw new Error('Nicht angemeldet')
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) throw new Error('Kein Zugriff')

  const holdingId = session.holdingId
  if (!holdingId) {
    return { success: false, error: 'Kein Holding zugewiesen.' }
  }

  if (!newValue || newValue.length === 0) {
    return { success: false, error: 'Neuer Secret-Wert ist erforderlich.' }
  }

  if (newValue.length > 10000) {
    return { success: false, error: 'Secret-Wert ist zu lang (max. 10000 Zeichen).' }
  }

  const serviceClient = createSupabaseServiceClient()

  // Verify the secret belongs to this holding
  const { data: existing, error: fetchError } = await serviceClient
    .from('holding_secrets')
    .select('id, name, holding_id, vault_id')
    .eq('id', secretId)
    .eq('holding_id', holdingId)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Secret nicht gefunden.' }
  }

  const existingRecord = existing as Record<string, unknown>

  // In production: UPDATE vault.decrypted_secrets or vault.create_secret(...)
  // For now, we generate a new vault_id to simulate rotation
  void newValue // Consumed but never persisted in application tables

  const newVaultId = crypto.randomUUID()

  const { error: updateError } = await serviceClient
    .from('holding_secrets')
    .update({
      vault_id: newVaultId,
      last_rotated_at: new Date().toISOString(),
    })
    .eq('id', secretId)
    .eq('holding_id', holdingId)

  if (updateError) {
    return { success: false, error: 'Fehler bei der Rotation. Bitte versuchen Sie es erneut.' }
  }

  // Audit log
  const supabase = createSupabaseServerClient()
  await supabase.from('audit_log').insert({
    holding_id: holdingId,
    actor_id: session.profile.id,
    action: 'secret.rotated',
    entity_type: 'holding_secret',
    entity_id: secretId,
    entity_name: existingRecord['name'] as string,
  })

  return { success: true }
}

// ---------------------------------------------------------------------------
// Deactivate Secret
// ---------------------------------------------------------------------------

export async function deactivateSecret(secretId: string): Promise<SecretActionResult> {
  const session = await getSession()
  if (!session) throw new Error('Nicht angemeldet')
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) throw new Error('Kein Zugriff')

  const holdingId = session.holdingId
  if (!holdingId) {
    return { success: false, error: 'Kein Holding zugewiesen.' }
  }

  const serviceClient = createSupabaseServiceClient()

  // Verify ownership
  const { data: existing, error: fetchError } = await serviceClient
    .from('holding_secrets')
    .select('id, name, holding_id')
    .eq('id', secretId)
    .eq('holding_id', holdingId)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Secret nicht gefunden.' }
  }

  const existingRecord = existing as Record<string, unknown>

  const { error: updateError } = await serviceClient
    .from('holding_secrets')
    .update({ is_active: false })
    .eq('id', secretId)
    .eq('holding_id', holdingId)

  if (updateError) {
    return { success: false, error: 'Fehler beim Deaktivieren. Bitte versuchen Sie es erneut.' }
  }

  // Audit log
  const supabase = createSupabaseServerClient()
  await supabase.from('audit_log').insert({
    holding_id: holdingId,
    actor_id: session.profile.id,
    action: 'secret.deactivated',
    entity_type: 'holding_secret',
    entity_id: secretId,
    entity_name: existingRecord['name'] as string,
  })

  return { success: true }
}

// ---------------------------------------------------------------------------
// Reactivate Secret
// ---------------------------------------------------------------------------

export async function reactivateSecret(secretId: string): Promise<SecretActionResult> {
  const session = await getSession()
  if (!session) throw new Error('Nicht angemeldet')
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) throw new Error('Kein Zugriff')

  const holdingId = session.holdingId
  if (!holdingId) {
    return { success: false, error: 'Kein Holding zugewiesen.' }
  }

  const serviceClient = createSupabaseServiceClient()

  // Verify ownership
  const { data: existing, error: fetchError } = await serviceClient
    .from('holding_secrets')
    .select('id, name, holding_id')
    .eq('id', secretId)
    .eq('holding_id', holdingId)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Secret nicht gefunden.' }
  }

  const existingRecord = existing as Record<string, unknown>

  const { error: updateError } = await serviceClient
    .from('holding_secrets')
    .update({ is_active: true })
    .eq('id', secretId)
    .eq('holding_id', holdingId)

  if (updateError) {
    return { success: false, error: 'Fehler beim Reaktivieren. Bitte versuchen Sie es erneut.' }
  }

  // Audit log
  const supabase = createSupabaseServerClient()
  await supabase.from('audit_log').insert({
    holding_id: holdingId,
    actor_id: session.profile.id,
    action: 'secret.reactivated',
    entity_type: 'holding_secret',
    entity_id: secretId,
    entity_name: existingRecord['name'] as string,
  })

  return { success: true }
}
