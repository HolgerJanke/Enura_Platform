import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CallScriptRow } from '@enura/types'
import { ScriptEditor } from './script-editor'

export default async function CallScriptPage() {
  await requirePermission('module:admin:write')

  const session = await getSession()
  if (!session?.tenantId) return null

  const supabase = createSupabaseServerClient()

  const { data: activeScript } = await supabase
    .from('call_scripts')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .eq('is_active', true)
    .maybeSingle()

  const { data: allScripts } = await supabase
    .from('call_scripts')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6">
      <ScriptEditor
        activeScript={(activeScript as CallScriptRow | null) ?? null}
        allScripts={(allScripts as CallScriptRow[] | null) ?? []}
      />
    </div>
  )
}
