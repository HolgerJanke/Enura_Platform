'use server'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
  const { data: sub } = await supabase
    .from('holding_subscriptions')
    .select('finanzplanung_enabled')
    .eq('holding_id', session.holdingId ?? '')
    .maybeSingle()

  if (!sub?.finanzplanung_enabled && enabled) {
    return { success: false, error: 'Finanzplanung ist fuer Ihre Holding nicht aktiviert.' }
  }

  const { error } = await supabase
    .from('company_feature_flags')
    .update({
      finanzplanung_enabled: enabled,
      finanzplanung_activated_at: enabled ? new Date().toISOString() : null,
      updated_by: session.profile.id,
    })
    .eq('company_id', companyId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/settings/addons')
  return { success: true }
}
