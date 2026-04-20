export const dynamic = 'force-dynamic'

import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CompanySettingsRow } from '@enura/types'
import { ReportSettingsForm } from './report-settings-form'

export default async function ReportSettingsPage() {
  await requirePermission('module:admin:write')

  const session = await getSession()
  if (!session?.companyId) return null

  const supabase = createSupabaseServerClient()

  const { data: settings } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', session.companyId)
    .maybeSingle()

  return (
    <div className="p-6">
      <ReportSettingsForm
        settings={(settings as CompanySettingsRow | null) ?? null}
      />
    </div>
  )
}
