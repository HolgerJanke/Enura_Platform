'use server'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await getSession()
  if (!session?.isHoldingAdmin && !session?.isEnuraAdmin) throw new Error('Nicht autorisiert')
  return session
}

export async function reorderProcessHouseAction(
  companyId: string,
  processType: 'M' | 'P' | 'S',
  order: Array<{ processId: string; sortOrder: number }>,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createSupabaseServerClient()

  for (const item of order) {
    await supabase
      .from('process_definitions')
      .update({ house_sort_order: item.sortOrder })
      .eq('id', item.processId)
  }

  revalidatePath('/admin/processes/house')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateProcessTypeAction(
  processId: string,
  processType: 'M' | 'P' | 'S' | null,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('process_definitions')
    .update({ process_type: processType })
    .eq('id', processId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/processes/house')
  revalidatePath('/dashboard')
  return { success: true }
}
