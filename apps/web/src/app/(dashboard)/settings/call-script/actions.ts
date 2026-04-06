'use server'

import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'
import { writeAuditLog } from '@/lib/audit'

export async function saveCallScriptAction(content: string): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.tenantId) return { error: 'Nicht autorisiert' }

  const trimmedContent = content.trim()
  if (trimmedContent.length === 0) {
    return { error: 'Der Leitfaden darf nicht leer sein.' }
  }

  const db = createSupabaseServiceClient()

  // Deactivate current active scripts
  await db.from('call_scripts').update({ is_active: false })
    .eq('tenant_id', session.tenantId)
    .eq('is_active', true)

  // Count existing versions to generate a version name
  const { count } = await db.from('call_scripts')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', session.tenantId)

  const versionNumber = (count ?? 0) + 1

  // Insert new version
  const { error: insertError } = await db.from('call_scripts').insert({
    tenant_id: session.tenantId,
    name: `Leitfaden v${versionNumber}`,
    content: trimmedContent,
    is_active: true,
    created_by: session.profile.id,
  })

  if (insertError) {
    return { error: 'Fehler beim Speichern. Bitte versuchen Sie es erneut.' }
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    actorId: session.profile.id,
    action: 'call_script.updated',
    tableName: 'call_scripts',
  })

  return { success: true }
}

export async function activateScriptVersionAction(scriptId: string): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.tenantId) return { error: 'Nicht autorisiert' }

  const db = createSupabaseServiceClient()

  // Deactivate all scripts for this tenant
  await db.from('call_scripts').update({ is_active: false })
    .eq('tenant_id', session.tenantId)

  // Activate selected version
  const { error: activateError } = await db.from('call_scripts').update({ is_active: true })
    .eq('id', scriptId)
    .eq('tenant_id', session.tenantId)

  if (activateError) {
    return { error: 'Fehler beim Aktivieren. Bitte versuchen Sie es erneut.' }
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    actorId: session.profile.id,
    action: 'call_script.version_activated',
    tableName: 'call_scripts',
    recordId: scriptId,
  })

  return { success: true }
}
