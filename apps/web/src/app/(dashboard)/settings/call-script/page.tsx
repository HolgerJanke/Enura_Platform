export const dynamic = 'force-dynamic'

import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CallScriptRow } from '@enura/types'
import { ScriptEditor } from './script-editor'

export default async function CallScriptPage() {
  await requirePermission('module:admin:write')

  const session = await getSession()
  if (!session?.companyId) return null

  const supabase = createSupabaseServerClient()

  const { data: activeScript } = await supabase
    .from('call_scripts')
    .select('*')
    .eq('company_id', session.companyId)
    .eq('is_active', true)
    .maybeSingle()

  const { data: allScripts } = await supabase
    .from('call_scripts')
    .select('*')
    .eq('company_id', session.companyId)
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
