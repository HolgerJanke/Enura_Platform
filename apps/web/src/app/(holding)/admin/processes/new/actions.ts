'use server'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const CreateProcessSchema = z.object({
  companyId: z.string().uuid('Ungültiges Unternehmen'),
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  category: z.enum(['verkauf', 'planung', 'abwicklung', 'betrieb', 'sonstige'], {
    errorMap: () => ({ message: 'Kategorie ist erforderlich' }),
  }),
  menuLabel: z.string().min(1, 'Menuelabel ist erforderlich').max(100),
  menuIcon: z.string().max(50).optional().default('clipboard'),
  visibleRoles: z.array(z.string()).min(1, 'Mindestens eine Rolle auswählen'),
  templateId: z.string().uuid().nullable().optional(),
})

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export interface CreateProcessResult {
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createProcessAction(
  formData: FormData,
): Promise<CreateProcessResult | never> {
  const session = await getSession()
  if (!session || !session.isHoldingAdmin) {
    return { error: 'Nicht autorisiert' }
  }

  const rawVisibleRoles = formData.getAll('visibleRoles') as string[]
  const templateIdRaw = formData.get('templateId') as string | null

  const parsed = CreateProcessSchema.safeParse({
    companyId: formData.get('companyId'),
    name: formData.get('name'),
    category: formData.get('category'),
    menuLabel: formData.get('menuLabel'),
    menuIcon: formData.get('menuIcon') || 'clipboard',
    visibleRoles: rawVisibleRoles,
    templateId: templateIdRaw && templateIdRaw !== '' ? templateIdRaw : null,
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string') {
        fieldErrors[key] = issue.message
      }
    }
    return { fieldErrors }
  }

  const { companyId, name, category, menuLabel, menuIcon, visibleRoles, templateId } = parsed.data

  const supabase = createSupabaseServerClient()

  // Resolve holding_id from company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('holding_id')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return { error: 'Unternehmen nicht gefunden' }
  }

  const holdingId = (company as { holding_id: string }).holding_id

  const { data: newProcess, error: insertError } = await supabase
    .from('process_definitions')
    .insert({
      holding_id: holdingId,
      company_id: companyId,
      template_id: templateId ?? null,
      name,
      category,
      menu_label: menuLabel,
      menu_icon: menuIcon,
      visible_roles: visibleRoles,
      status: 'draft',
      version: '1.0.0',
      created_by: session.profile.id,
    })
    .select('id')
    .single()

  if (insertError || !newProcess) {
    if (insertError?.code === '23505') {
      return { error: 'Ein Prozess mit diesem Namen existiert bereits für dieses Unternehmen.' }
    }
    return { error: 'Fehler beim Erstellen des Prozesses.' }
  }

  const processId = (newProcess as { id: string }).id
  redirect(`/admin/processes/${processId}`)
}
