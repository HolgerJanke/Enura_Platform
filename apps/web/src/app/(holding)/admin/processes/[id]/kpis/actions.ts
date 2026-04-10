'use server'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

async function requireAdmin() {
  const session = await getSession()
  if (!session?.isHoldingAdmin && !session?.isEnuraAdmin) throw new Error('Nicht autorisiert')
  return session
}

const KpiSchema = z.object({
  processId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  unit: z.string().max(20).optional().default(''),
  targetValue: z.number().nullable().optional(),
  warningThreshold: z.number().nullable().optional(),
  criticalThreshold: z.number().nullable().optional(),
  dataSource: z.string().max(200).optional(),
  visibleRoles: z.array(z.string()).optional().default([]),
})

export async function createProcessKpi(
  input: z.infer<typeof KpiSchema>,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin()
  const parsed = KpiSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Ungültige Eingabe.' }

  const supabase = createSupabaseServerClient()

  // Get process holding/company
  const { data: proc } = await supabase
    .from('process_definitions')
    .select('holding_id, company_id')
    .eq('id', parsed.data.processId)
    .single()

  if (!proc) return { success: false, error: 'Prozess nicht gefunden.' }

  const { error } = await supabase
    .from('process_kpi_definitions')
    .insert({
      holding_id: (proc as Record<string, unknown>)['holding_id'] as string,
      company_id: (proc as Record<string, unknown>)['company_id'] as string | null,
      process_id: parsed.data.processId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      unit: parsed.data.unit ?? '',
      target_value: parsed.data.targetValue ?? null,
      warning_threshold: parsed.data.warningThreshold ?? null,
      critical_threshold: parsed.data.criticalThreshold ?? null,
      data_source: parsed.data.dataSource ?? null,
      visible_roles: parsed.data.visibleRoles ?? [],
      created_by: session.profile.id,
    })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/admin/processes/${parsed.data.processId}/kpis`)
  return { success: true }
}

export async function deleteProcessKpi(
  kpiId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createSupabaseServerClient()

  await supabase.from('process_kpi_values').delete().eq('kpi_id', kpiId)
  const { error } = await supabase.from('process_kpi_definitions').delete().eq('id', kpiId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/processes')
  return { success: true }
}
