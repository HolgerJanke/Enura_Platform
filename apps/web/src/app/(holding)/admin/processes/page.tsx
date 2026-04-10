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

export default async function ProcessListPage() {
  await requireHoldingAdmin()

  const supabase = createSupabaseServerClient()

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
