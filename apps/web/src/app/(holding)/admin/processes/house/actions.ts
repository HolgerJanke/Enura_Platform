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

// ---------------------------------------------------------------------------
// Phase CRUD
// ---------------------------------------------------------------------------

export async function addPhaseAction(
  processId: string,
  holdingId: string,
  companyId: string,
  name: string,
): Promise<{ success: boolean; error?: string; phaseId?: string }> {
  await requireAdmin()
  const supabase = createSupabaseServerClient()

  // Determine next sort_order
  const { data: existing } = await supabase
    .from('process_phases')
    .select('sort_order')
    .eq('process_id', processId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = ((existing?.[0] as Record<string, unknown> | undefined)?.['sort_order'] as number ?? -1) + 1

  const { data, error } = await supabase
    .from('process_phases')
    .insert({
      process_id: processId,
      holding_id: holdingId,
      company_id: companyId,
      name,
      sort_order: nextOrder,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/processes/house')
  revalidatePath('/dashboard')
  return { success: true, phaseId: (data as Record<string, unknown>)['id'] as string }
}

export async function updatePhaseAction(
  phaseId: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('process_phases')
    .update({ name })
    .eq('id', phaseId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/processes/house')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deletePhaseAction(
  phaseId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('process_phases')
    .delete()
    .eq('id', phaseId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/processes/house')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function reorderPhasesAction(
  processId: string,
  order: Array<{ phaseId: string; sortOrder: number }>,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createSupabaseServerClient()

  for (const item of order) {
    await supabase
      .from('process_phases')
      .update({ sort_order: item.sortOrder })
      .eq('id', item.phaseId)
  }

  revalidatePath('/admin/processes/house')
  revalidatePath('/dashboard')
  return { success: true }
}
