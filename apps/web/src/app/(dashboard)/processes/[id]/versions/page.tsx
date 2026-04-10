import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Server component — Version history
// ---------------------------------------------------------------------------

export default async function ProcessVersionsPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSession()
  if (!session) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)

  // Must be super_user or holding admin
  const isSuperUser = session.roles.some((r) => r.key === 'super_user')
  if (!isSuperUser && !session.isHoldingAdmin) {
  return (<div className="p-8 text-center"><a href="/dashboard" className="text-blue-600 underline">Zum Dashboard</a></div>)
  }

  const supabase = createSupabaseServerClient()
  const processId = params.id

  // Fetch process name
  const { data: processDef } = await supabase
    .from('process_definitions')
    .select('id, name, company_id')
    .eq('id', processId)
    .single()

  if (!processDef) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            Prozess nicht gefunden.
          </p>
        </div>
      </div>
    )
  }

  const defRow = processDef as Record<string, unknown>

  // Verify company ownership
  if (
    session.companyId &&
    (defRow['company_id'] as string | null) !== session.companyId
  ) {
  return (<div className="p-8 text-center"><a href="/dashboard" className="text-blue-600 underline">Zum Dashboard</a></div>)
  }

  // Fetch versions with creator profile
  const { data: versionsData } = await supabase
    .from('process_versions')
    .select('id, version, snapshot, change_summary, created_by, created_at')
    .eq('process_id', processId)
    .order('created_at', { ascending: false })

  const versions = ((versionsData ?? []) as Record<string, unknown>[]).map((v) => ({
    id: v['id'] as string,
    version: v['version'] as string,
    snapshot: v['snapshot'] as Record<string, unknown> | null,
    changeSummary: (v['change_summary'] as string | null) ?? '',
    createdBy: (v['created_by'] as string | null) ?? null,
    createdAt: v['created_at'] as string,
  }))

  // Fetch creator profiles
  const creatorIds = [...new Set(versions.map((v) => v.createdBy).filter((id): id is string => id !== null))]
  let creatorMap: Record<string, string> = {}

  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, last_name')
      .in('id', creatorIds)

    creatorMap = ((profiles ?? []) as Record<string, unknown>[]).reduce<Record<string, string>>((acc, p) => {
      const id = p['id'] as string
      const displayName = p['display_name'] as string | null
      const firstName = p['first_name'] as string | null
      const lastName = p['last_name'] as string | null
      acc[id] = displayName ?? ([firstName, lastName].filter(Boolean).join(' ') || 'Unbekannt')
      return acc
    }, {})
  }

  const processName = defRow['name'] as string

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href={`/processes/${processId}`}
            className="flex items-center gap-1 text-sm text-[var(--brand-primary,#1A56DB)] hover:underline"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zurueck zum Prozess
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--brand-text-primary,#111827)]">
          Versionshistorie
        </h1>
        <p className="mt-1 text-[var(--brand-text-secondary,#6B7280)]">
          {processName}
        </p>
      </div>

      {/* Versions table */}
      {versions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            Keine Versionen vorhanden.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--brand-text-secondary,#6B7280)]"
                >
                  Version
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--brand-text-secondary,#6B7280)]"
                >
                  Typ
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--brand-text-secondary,#6B7280)]"
                >
                  Erstellt von
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--brand-text-secondary,#6B7280)]"
                >
                  Datum
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--brand-text-secondary,#6B7280)]"
                >
                  Aenderungsnotiz
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {versions.map((v) => {
                const versionType = resolveVersionType(v.snapshot, v.changeSummary)
                const creatorName = v.createdBy ? (creatorMap[v.createdBy] ?? 'Unbekannt') : 'System'
                const formattedDate = formatDate(v.createdAt)

                return (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center rounded bg-gray-100 px-2.5 py-0.5 text-sm font-mono font-medium text-[var(--brand-text-primary,#111827)]">
                        v{v.version}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          versionType === 'Strukturell'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {versionType}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--brand-text-primary,#111827)]">
                      {creatorName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--brand-text-secondary,#6B7280)]">
                      {formattedDate}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--brand-text-secondary,#6B7280)] max-w-xs truncate">
                      {v.changeSummary || '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveVersionType(
  snapshot: Record<string, unknown> | null,
  changeSummary: string,
): string {
  if (snapshot && (snapshot['type'] as string | undefined) === 'redaktionell') {
    return 'Redaktionell'
  }
  if (changeSummary.toLowerCase().includes('redaktionell')) {
    return 'Redaktionell'
  }
  return 'Strukturell'
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return isoString
  }
}
