import Link from 'next/link'
import { requireHoldingAdmin } from '@/lib/permissions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@enura/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyProcessInfo {
  companyId: string
  companyName: string
  companySlug: string
  processCount: number
  lastDeployedAt: string | null
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProcessListPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>
}) {
  await requireHoldingAdmin()

  const supabase = createSupabaseServerClient()
  const params = await searchParams
  const selectedCompanyId = params.company ?? null

  // If a company is selected, show its processes
  if (selectedCompanyId) {
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', selectedCompanyId)
      .single()

    const { data: processes } = await supabase
      .from('process_definitions')
      .select('id, name, menu_label, category, process_type, status, version, deployed_at, house_sort_order')
      .eq('company_id', selectedCompanyId)
      .order('house_sort_order')

    const companyName = company ? (company as Record<string, unknown>)['name'] as string : 'Unbekannt'

    // Sort by process_type (M → P → S → null) then by house_sort_order
    const typeOrder: Record<string, number> = { M: 0, P: 1, S: 2 }
    const procs = ((processes ?? []) as Array<{
      id: string; name: string; menu_label: string; category: string;
      process_type: string | null; status: string; version: string; deployed_at: string | null;
      house_sort_order: number
    }>).sort((a, b) => {
      const ta = typeOrder[a.process_type ?? ''] ?? 3
      const tb = typeOrder[b.process_type ?? ''] ?? 3
      if (ta !== tb) return ta - tb
      return (a.house_sort_order ?? 0) - (b.house_sort_order ?? 0)
    })

    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin/processes" className="text-sm text-gray-500 hover:text-gray-700">← Zurück</Link>
            <h1 className="text-2xl font-semibold text-gray-900">Prozesse — {companyName}</h1>
          </div>
          <Link
            href={`/admin/processes/new?company=${selectedCompanyId}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            + Neuer Prozess
          </Link>
        </div>

        {procs.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">Keine Prozesse vorhanden.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Kategorie</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {procs.map((proc) => (
                  <tr key={proc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {proc.process_type ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                          proc.process_type === 'M' ? 'bg-teal-100 text-teal-700' :
                          proc.process_type === 'P' ? 'bg-green-100 text-green-700' :
                          'bg-sky-100 text-sky-700'
                        }`}>{proc.process_type}</span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <Link href={`/admin/processes/${proc.id}`} className="text-blue-600 hover:underline">
                        {proc.menu_label}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{proc.category}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        proc.status === 'deployed' ? 'bg-green-100 text-green-700' :
                        proc.status === 'draft' ? 'bg-gray-100 text-gray-500' :
                        'bg-amber-100 text-amber-700'
                      }`}>{proc.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">v{proc.version}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/processes/${proc.id}`} className="text-sm text-blue-600 hover:underline">
                        Bearbeiten
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('id, name, slug, status')
    .eq('status', 'active')
    .order('name')

  if (companiesError) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-medium text-red-900 mb-1">Fehler beim Laden</h2>
          <p className="text-sm text-red-700">
            Die Unternehmensdaten konnten nicht geladen werden.
          </p>
        </div>
      </div>
    )
  }

  const companyList = (companies ?? []) as Array<{
    id: string
    name: string
    slug: string
    status: string
  }>

  // Fetch process counts and last deployment per company
  const companyInfos: CompanyProcessInfo[] = await Promise.all(
    companyList.map(async (company) => {
      const [countResult, deployResult] = await Promise.all([
        supabase
          .from('process_definitions')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id),
        supabase
          .from('process_definitions')
          .select('deployed_at')
          .eq('company_id', company.id)
          .not('deployed_at', 'is', null)
          .order('deployed_at', { ascending: false })
          .limit(1),
      ])

      const lastDeployRow = (deployResult.data ?? [])[0] as
        | { deployed_at: string | null }
        | undefined

      return {
        companyId: company.id,
        companyName: company.name,
        companySlug: company.slug,
        processCount: countResult.count ?? 0,
        lastDeployedAt: lastDeployRow?.deployed_at ?? null,
      }
    }),
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Prozess-Builder</h1>
          <p className="text-gray-500 mt-1">
            Geschäftsprozesse für Tochtergesellschaften entwerfen und verwalten
          </p>
        </div>
        <Link
          href="/admin/processes/templates"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Vorlagen verwalten
        </Link>
      </div>

      {/* Company cards grid */}
      {companyInfos.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">Keine aktiven Unternehmen gefunden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companyInfos.map((info) => (
            <div
              key={info.companyId}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Company name */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{info.companyName}</h3>
                  <p className="text-sm text-gray-500">{info.companySlug}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                  {info.processCount} {info.processCount === 1 ? 'Prozess' : 'Prozesse'}
                </span>
              </div>

              {/* Stats */}
              <div className="space-y-2 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Prozesse</span>
                  <span className="font-medium text-gray-900">{info.processCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Letztes Deployment</span>
                  <span className="font-medium text-gray-900">
                    {info.lastDeployedAt ? formatDate(info.lastDeployedAt) : 'Noch keins'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Link
                  href={`/admin/processes/new?company=${info.companyId}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Neuer Prozess
                </Link>
                {info.processCount > 0 && (
                  <Link
                    href={`/admin/processes?company=${info.companyId}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Alle anzeigen
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
