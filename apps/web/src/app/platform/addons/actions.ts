'use server'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Enura Admin: toggle finanzplanung licensing for a holding
//
// Moved here from `(holding)/admin/settings/addons/actions.ts` (finding C5)
// alongside its Enura-only page — this is an Enura-tier mutation and now
// lives under the Enura-owned `/platform` route.
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

  revalidatePath('/platform/addons')
  return { success: true }
}
