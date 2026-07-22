export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NewProcessForm } from './new-process-form'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyOption {
  id: string
  name: string
}

interface TemplateOption {
  id: string
  name: string
  category: string
  description: string | null
}

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function NewProcessPage({
  searchParams,
}: {
  searchParams: { company?: string }
}) {
  const session = await getSession()
  if (!session) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) return (<div className="p-8 text-center"><a href="/login" className="text-blue-600 underline">Weiter</a></div>)

  const holdingId = session.holdingId
  if (!holdingId) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Kein Holding zugewiesen. Bitte kontaktieren Sie den Support.</p>
        </div>
      </div>
    )
  }

  const supabase = createSupabaseServerClient()

  const [companiesResult, templatesResult] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name')
      .eq('holding_id', holdingId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('process_templates')
      .select('id, name, category, description')
      .eq('is_active', true)
      .order('name'),
  ])

  const companies: CompanyOption[] = (
    (companiesResult.data ?? []) as Array<{ id: string; name: string }>
  ).map((c) => ({ id: c.id, name: c.name }))

  const templates: TemplateOption[] = (
    (templatesResult.data ?? []) as Array<{
      id: string
      name: string
      category: string
      description: string | null
    }>
  ).map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
  }))

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Neuer Prozess</h1>
        <p className="text-gray-500 mt-1">
          Erstellen Sie einen neuen Geschäftsprozess für ein Unternehmen.
        </p>
      </div>

      <NewProcessForm
        companies={companies}
        templates={templates}
        preselectedCompanyId={searchParams.company ?? null}
      />
    </div>
  )
}
