import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { TenantSettingsRow } from '@enura/types'
import { ReportSettingsForm } from './report-settings-form'

export default async function ReportSettingsPage() {
  await requirePermission('module:admin:write')

  const session = await getSession()
  if (!session?.tenantId) return null

  const supabase = createSupabaseServerClient()

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .maybeSingle()

  return (
    <div className="p-6">
      <ReportSettingsForm
        settings={(settings as TenantSettingsRow | null) ?? null}
      />
    </div>
  )
}
