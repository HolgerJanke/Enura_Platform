import { requireHoldingAdmin } from '@/lib/permissions'
import { getHoldingBranding } from './actions'
import { BrandingEditorClient } from './branding-editor-client'

export default async function HoldingBrandingPage() {
  await requireHoldingAdmin()

  const branding = await getHoldingBranding()

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Holding-Branding</h1>
        <p className="text-gray-500 mt-1">
          Definieren Sie das Standard-Erscheinungsbild fuer die gesamte Holding.
          Tochtergesellschaften koennen einzelne Werte ueberschreiben.
        </p>
      </div>

      <BrandingEditorClient initialBranding={branding} />
    </div>
  )
}
