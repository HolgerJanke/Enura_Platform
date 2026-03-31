import { requirePermission, checkPermission } from '@/lib/permissions'
import { getCompanyDesign } from './actions'
import DesignModuleClient from './design-module-client'

export default async function BrandingSettingsPage() {
  await requirePermission('module:admin:branding')

  const { data, error } = await getCompanyDesign()
  const hasHoldingAccess = await checkPermission('holding:global')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  if (error || !data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-[var(--brand-text-primary)] mb-2">
          Corporate Design
        </h1>
        <div className="bg-red-50 border border-red-200 rounded-[var(--brand-radius)] p-4">
          <p className="text-sm text-red-700">
            {error ?? 'Designdaten konnten nicht geladen werden.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-[var(--brand-text-primary)] mb-2">
        Corporate Design
      </h1>
      <p className="text-[var(--brand-text-secondary)] mb-6">
        Verwalten Sie das visuelle Erscheinungsbild Ihrer Firmenumgebung.
      </p>

      <DesignModuleClient
        initialData={data}
        hasHoldingAccess={hasHoldingAccess}
        supabaseUrl={supabaseUrl}
      />
    </div>
  )
}
