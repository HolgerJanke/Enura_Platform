import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { TemplateUploadForm } from './template-upload-form'

const CATEGORY_LABELS: Record<string, string> = {
  verkauf: 'Verkauf',
  planung: 'Planung',
  abwicklung: 'Abwicklung',
  betrieb: 'Betrieb',
  sonstige: 'Sonstige',
  // Legacy English values (in case DB still has them)
  sales: 'Verkauf',
  operations: 'Planung',
  finance: 'Abwicklung',
  hr: 'Betrieb',
  support: 'Sonstige',
  custom: 'Sonstige',
}

interface TemplateRow {
  id: string
  name: string
  description: string | null
  category: string
  steps: unknown[]
  version: string
  is_active: boolean
  created_at: string
}

export default async function ProcessTemplatesPage() {
  const session = await getSession()

  const isSuperUser = session?.roles.some((r) => r.key === 'super_user') ?? false
  if (!session || (!session.isHoldingAdmin && !isSuperUser)) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Kein Zugriff.</p>
        <Link href="/dashboard" className="text-blue-600 underline text-sm mt-2 inline-block">
          Zum Dashboard
        </Link>
      </div>
    )
  }

  // Fetch existing templates
  const supabase = createSupabaseServerClient()
  const { data: templates } = await supabase
    .from('process_templates')
    .select('id, name, description, category, steps, version, is_active, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const templateList = (templates ?? []) as TemplateRow[]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Prozessvorlagen</h1>
        <Link
          href="/admin/processes"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Zurueck zu Prozesse
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Laden Sie JSON-Vorlagen hoch, die beim Erstellen neuer Prozesse als Ausgangsbasis dienen.
      </p>

      {/* Upload section */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Vorlage hochladen</h2>
        <TemplateUploadForm />
      </div>

      {/* Existing templates */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Vorhandene Vorlagen ({templateList.length})
        </h2>

        {templateList.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">
              Noch keine Vorlagen vorhanden. Laden Sie eine JSON-Datei hoch, um zu beginnen.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templateList.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 truncate pr-2">
                    {t.name}
                  </h3>
                  <span className="inline-flex shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {CATEGORY_LABELS[t.category] ?? t.category}
                  </span>
                </div>
                {t.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{t.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{Array.isArray(t.steps) ? t.steps.length : 0} Schritte</span>
                  <span>v{t.version}</span>
                  <span>
                    {new Date(t.created_at).toLocaleDateString('de-CH', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
