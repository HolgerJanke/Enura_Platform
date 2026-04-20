export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireHoldingAdmin } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@enura/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProcessVersionEntry {
  id: string
  version: string
  changeSummary: string | null
  createdByName: string | null
  createdAt: string
  isDeployed: boolean
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProcessVersionsPage({
  params,
}: {
  params: { id: string }
}) {
  await requireHoldingAdmin()
  const session = await getSession()
  if (!session) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)

  const supabase = createSupabaseServerClient()
  const processId = params.id

  // Fetch process definition
  const { data: process } = await supabase
    .from('process_definitions')
    .select('id, name, version, deployed_version, holding_id')
    .eq('id', processId)
    .single()

  if (!process) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Prozess nicht gefunden.</p>
        </div>
      </div>
    )
  }

  // Fetch all versions with creator profiles
  const { data: versions } = await supabase
    .from('process_versions')
    .select('id, version, change_summary, created_by, created_at')
    .eq('process_id', processId)
    .order('created_at', { ascending: false })

  // Fetch creator names
  const creatorIds = [
    ...new Set(
      ((versions ?? []) as Record<string, unknown>[])
        .map((v) => v['created_by'] as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  let creatorMap: Record<string, string> = {}
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, last_name')
      .in('id', creatorIds)

    creatorMap = ((profiles ?? []) as Record<string, unknown>[]).reduce<
      Record<string, string>
    >((acc, p) => {
      const id = p['id'] as string
      const displayName = p['display_name'] as string | null
      const firstName = p['first_name'] as string | null
      const lastName = p['last_name'] as string | null
      acc[id] = displayName ?? [firstName, lastName].filter(Boolean).join(' ') ?? 'Unbekannt'
      return acc
    }, {})
  }

  const processRow = process as Record<string, unknown>
  const deployedVersion = processRow['deployed_version'] as string | null

  const entries: ProcessVersionEntry[] = (
    (versions ?? []) as Record<string, unknown>[]
  ).map((v) => ({
    id: v['id'] as string,
    version: v['version'] as string,
    changeSummary: (v['change_summary'] as string | null) ?? null,
    createdByName:
      creatorMap[(v['created_by'] as string) ?? ''] ?? null,
    createdAt: v['created_at'] as string,
    isDeployed: (v['version'] as string) === deployedVersion,
  }))

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-500" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/admin/processes" className="hover:text-gray-700">
              Prozesse
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/admin/processes/${processId}/deploy`}
              className="hover:text-gray-700"
            >
              {(processRow['name'] as string) ?? 'Prozess'}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-900 font-medium">Versionen</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Versionshistorie
          </h1>
          <p className="text-gray-500 mt-1">
            {(processRow['name'] as string) ?? 'Prozess'} &mdash; Alle
            gespeicherten Versionen
          </p>
        </div>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            Noch keine Versionen vorhanden.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Version
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Erstellt von
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Datum
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Änderungen
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Status
                </th>
                <th scope="col" className="relative px-4 py-3">
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono font-medium text-gray-900">
                    v{entry.version}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {entry.createdByName ?? 'System'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatDate(new Date(entry.createdAt))}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {entry.changeSummary ?? '\u2014'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {entry.isDeployed ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        Deployed
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Archiviert
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <Link
                      href={`/admin/processes/${processId}/deployments/${entry.id}`}
                      className="text-[var(--brand-primary,#1A56DB)] hover:underline"
                      aria-label={`Diff für Version ${entry.version} anzeigen`}
                    >
                      Diff anzeigen
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
