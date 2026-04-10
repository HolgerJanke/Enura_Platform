'use server'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Enura Admin: toggle finanzplanung for a holding
// ---------------------------------------------------------------------------

export async function toggleHoldingFinanzplanung(
  holdingId: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session?.isEnuraAdmin) {
    return { success: false, error: 'Nur Enura-Admins können Holdings lizenzieren.' }
  }

  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('holding_subscriptions')
    .update({
      finanzplanung_enabled: enabled,
      finanzplanung_activated_at: enabled ? new Date().toISOString() : null,
    })
    .eq('holding_id', holdingId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/settings/addons')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Holding Admin: toggle finanzplanung for a company
// ---------------------------------------------------------------------------

export async function toggleCompanyFinanzplanung(
  companyId: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session?.isHoldingAdmin && !session?.isEnuraAdmin) {
    return { success: false, error: 'Keine Berechtigung.' }
  }

  const supabase = createSupabaseServerClient()

  // Verify holding has finanzplanung enabled
  if (enabled) {
    const holdingId = session.holdingId ?? ''
    const { data: sub } = await supabase
      .from('holding_subscriptions')
      .select('finanzplanung_enabled')
      .eq('holding_id', holdingId)
      .maybeSingle()

    if (!sub?.finanzplanung_enabled) {
      return { success: false, error: 'Finanzplanung ist für Ihre Holding nicht aktiviert.' }
    }
  }

  const { error } = await supabase
    .from('company_feature_flags')
    .update({
      finanzplanung_enabled: enabled,
      finanzplanung_activated_at: enabled ? new Date().toISOString() : null,
      updated_by: session.profile.id,
    })
    .eq('company_id', companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/settings/addons')
  return { success: true }
}
