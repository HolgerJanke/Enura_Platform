'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

async function requireEnuraSession() {
  const session = await getSession()
  if (!session?.isEnuraAdmin) {
    throw new Error('Nicht autorisiert')
  }
  return session
}

export async function updateHolding(formData: FormData): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()

  const holdingId = formData.get('holdingId') as string
  if (!holdingId) return { success: false, error: 'Holding-ID fehlt' }

  const supabase = createSupabaseServerClient()

  const updates: Record<string, string> = {}
  const name = formData.get('name') as string | null
  const primaryDomain = formData.get('primary_domain') as string | null

  if (name) updates.name = name
  if (primaryDomain !== null) updates.primary_domain = primaryDomain

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'Keine Änderungen' }
  }

  const { error } = await supabase
    .from('holdings')
    .update(updates)
    .eq('id', holdingId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/platform/holdings/${holdingId}`)
  revalidatePath('/platform')
  return { success: true }
}

export async function suspendHolding(formData: FormData): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()

  const holdingId = formData.get('holdingId') as string
  if (!holdingId) return { success: false, error: 'Holding-ID fehlt' }

  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('holdings')
    .update({ status: 'suspended' })
    .eq('id', holdingId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/platform/holdings/${holdingId}`)
  revalidatePath('/platform')
  return { success: true }
}

export async function updateSubscription(formData: FormData): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()

  const holdingId = formData.get('holdingId') as string
  if (!holdingId) return { success: false, error: 'Holding-ID fehlt' }

  const supabase = createSupabaseServerClient()

  const updates = {
    plan: formData.get('plan') as string,
    billing_cycle: formData.get('billing_cycle') as string,
    ai_calls_enabled: formData.get('ai_calls_enabled') === 'true',
    process_builder_enabled: formData.get('process_builder_enabled') === 'true',
    liquidity_enabled: formData.get('liquidity_enabled') === 'true',
    max_companies: Number(formData.get('max_companies')),
    max_users_per_company: Number(formData.get('max_users_per_company')),
  }

  const { error } = await supabase
    .from('holding_subscriptions')
    .update(updates)
    .eq('holding_id', holdingId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/platform/holdings/${holdingId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Holding Admin promotion (Enura Admin only)
// ---------------------------------------------------------------------------

export async function promoteToHoldingAdmin(
  holdingId: string,
  profileId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()

  const supabase = createSupabaseServerClient()

  // Verify user belongs to this holding
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, holding_id')
    .eq('id', profileId)
    .single()

  if (!profile) return { success: false, error: 'Benutzer nicht gefunden.' }

  // Update user's holding_id if not set
  if (!(profile as Record<string, unknown>)['holding_id']) {
    await supabase.from('profiles').update({ holding_id: holdingId }).eq('id', profileId)
  }

  // Insert into holding_admins (legacy table checked by session)
  await supabase
    .from('holding_admins')
    .upsert({ profile_id: profileId }, { onConflict: 'profile_id' })

  // Also insert into holding_admins_v2 (per-holding)
  const { error } = await supabase
    .from('holding_admins_v2')
    .upsert(
      { holding_id: holdingId, profile_id: profileId, is_owner: false },
      { onConflict: 'holding_id,profile_id' },
    )

  if (error) return { success: false, error: error.message }

  revalidatePath(`/platform/holdings/${holdingId}`)
  return { success: true }
}

export async function removeHoldingAdmin(
  holdingId: string,
  profileId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireEnuraSession()

  const supabase = createSupabaseServerClient()

  // Remove from holding_admins_v2
  await supabase
    .from('holding_admins_v2')
    .delete()
    .eq('holding_id', holdingId)
    .eq('profile_id', profileId)

  // Remove from legacy holding_admins
  await supabase
    .from('holding_admins')
    .delete()
    .eq('profile_id', profileId)

  revalidatePath(`/platform/holdings/${holdingId}`)
  return { success: true }
}
