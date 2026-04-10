import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireHoldingAdmin } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@enura/types'
import { DeployForm } from './deploy-form'

export default async function DeployPage({
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
    .select(
      'id, name, description, version, deployed_version, status, holding_id, company_id, category',
    )
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

  const processRow = process as Record<string, unknown>

  // Fetch companies for target selection
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, slug, status')
    .eq('status', 'active')
    .order('name')

  // Fetch recent deployments for this process
  const { data: recentDeployments } = await supabase
    .from('process_deployments')
    .select('id, version, status, requested_at, company_id')
    .eq('process_id', processId)
    .order('requested_at', { ascending: false })
    .limit(5)

  const companyList = ((companies ?? []) as Record<string, unknown>[]).map(
    (c) => ({
      id: c['id'] as string,
      name: c['name'] as string,
      slug: c['slug'] as string,
    }),
  )

  const deploymentList = (
    (recentDeployments ?? []) as Record<string, unknown>[]
  ).map((d) => ({
    id: d['id'] as string,
    version: d['version'] as string,
    status: d['status'] as string,
    requestedAt: d['requested_at'] as string,
    companyId: d['company_id'] as string | null,
  }))

  const statusLabels: Record<string, string> = {
    draft: 'Entwurf',
    finalised: 'Finalisiert',
    pending_approval: 'Freigabe ausstehend',
    deployed: 'Deployed',
    archived: 'Archiviert',
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-500" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/admin" className="hover:text-gray-700">
              Admin
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-900 font-medium">
            {processRow['name'] as string}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Deployment beantragen
          </h1>
          <p className="text-gray-500 mt-1">
            {processRow['name'] as string} &mdash; Version{' '}
            {processRow['version'] as string}
          </p>
        </div>
        <Link
          href={`/admin/processes/${processId}/versions`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          aria-label="Versionshistorie anzeigen"
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Versionen
        </Link>
      </div>

      {/* Current state card */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Aktuelle Version
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            v{processRow['version'] as string}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Deployed Version
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {(processRow['deployed_version'] as string | null)
              ? `v${processRow['deployed_version'] as string}`
              : '\u2014'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Status
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {statusLabels[processRow['status'] as string] ??
              (processRow['status'] as string)}
          </p>
        </div>
      </div>

      {/* Deploy form */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Neues Deployment
        </h2>
        <DeployForm
          processId={processId}
          holdingId={processRow['holding_id'] as string}
          currentVersion={processRow['version'] as string}
          companies={companyList}
          currentCompanyId={
            (processRow['company_id'] as string | null) ?? undefined
          }
        />
      </div>

      {/* Recent deployments */}
      {deploymentList.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Letzte Deployments
          </h2>
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
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Beantragt am
                  </th>
                  <th scope="col" className="relative px-4 py-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {deploymentList.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-900">
                      v{d.version}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <DeploymentStatusBadge status={d.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatDate(new Date(d.requestedAt))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <Link
                        href={`/admin/processes/${processId}/deployments/${d.id}`}
                        className="text-[var(--brand-primary,#1A56DB)] hover:underline"
                        aria-label={`Details fuer Deployment v${d.version}`}
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status badge sub-component
// ---------------------------------------------------------------------------

function DeploymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; classes: string }> = {
    pending_approval: {
      label: 'Ausstehend',
      classes: 'bg-yellow-100 text-yellow-800',
    },
    approved: {
      label: 'Freigegeben',
      classes: 'bg-blue-100 text-blue-800',
    },
    rejected: {
      label: 'Abgelehnt',
      classes: 'bg-red-100 text-red-800',
    },
    deployed: {
      label: 'Deployed',
      classes: 'bg-green-100 text-green-800',
    },
    rolled_back: {
      label: 'Rollback',
      classes: 'bg-gray-100 text-gray-800',
    },
  }

  const c = config[status] ?? {
    label: status,
    classes: 'bg-gray-100 text-gray-600',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c.classes}`}
    >
      {c.label}
    </span>
  )
}
