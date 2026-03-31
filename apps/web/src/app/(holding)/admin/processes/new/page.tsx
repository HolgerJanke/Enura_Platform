import { requireHoldingAdmin } from '@/lib/permissions'
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
  await requireHoldingAdmin()

  const supabase = createSupabaseServerClient()

  const [companiesResult, templatesResult] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name')
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
          Erstellen Sie einen neuen Geschaeftsprozess fuer ein Unternehmen.
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
