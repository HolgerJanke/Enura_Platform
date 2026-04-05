import { requireHoldingAdmin } from '@/lib/permissions'
import { getHoldingBranding } from './actions'
import { BrandingEditorClient } from './branding-editor-client'

export default async function HoldingBrandingPage() {
  const isAdmin = await requireHoldingAdmin()
  if (!isAdmin) return (<div className="p-8 text-center"><p className="text-gray-500">Kein Zugriff.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)

  let branding: Awaited<ReturnType<typeof getHoldingBranding>> | null = null
  try {
    branding = await getHoldingBranding()
  } catch {
    return (<div className="p-8 text-center"><p className="text-gray-500">Branding konnte nicht geladen werden.</p><a href="/admin" className="text-blue-600 underline">Zurueck</a></div>)
  }
  if (!branding) return (<div className="p-8 text-center"><p className="text-gray-500">Keine Branding-Daten.</p></div>)

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
