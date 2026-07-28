'use server'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Holding Admin: toggle finanzplanung for a company
//
// The Enura cross-holding `toggleHoldingFinanzplanung` action that used to
// live here was moved to `apps/web/src/app/platform/addons/actions.ts`
// (finding C5) alongside its relocated Enura-only page. This action is
// Holding-tier only — tightened from `!isHoldingAdmin && !isEnuraAdmin` to
// `!isHoldingAdmin`, since a pure Enura admin is not a Holding user (OD-2)
// and has no reason to mutate a specific holding's company activation flags
// from here.
// ---------------------------------------------------------------------------

export async function toggleCompanyFinanzplanung(
  companyId: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session?.isHoldingAdmin) {
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
