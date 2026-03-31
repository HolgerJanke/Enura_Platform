import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireHoldingAdmin } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@enura/types'
import { DiffViewer } from './diff-viewer'
import { ApprovalControls } from './approval-controls'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VersionSnapshot {
  steps: Array<{
    id: string
    process_step_id: string
    name: string
    description: string | null
    responsible_roles: string[]
    sort_order: number
    show_in_flowchart: boolean
    liquidity_marker: string | null
    sources: Array<{ label: string; source_type: string }>
    interfaces: Array<{ label: string; interface_type: string }>
  }>
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DeploymentApprovalPage({
  params,
}: {
  params: { id: string; deploymentId: string }
}) {
  await requireHoldingAdmin()
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createSupabaseServerClient()
  const { id: processId, deploymentId } = params

  // Fetch the deployment
  const { data: deployment } = await supabase
    .from('process_deployments')
    .select(
      'id, process_id, version, status, requested_by, requested_at, reviewed_by, reviewed_at, review_notes, reason, rollback_of, holding_id, company_id',
    )
    .eq('id', deploymentId)
    .single()

  if (!deployment) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Deployment nicht gefunden.</p>
        </div>
      </div>
    )
  }

  const deployRow = deployment as Record<string, unknown>

  // Fetch process definition
  const { data: process } = await supabase
    .from('process_definitions')
    .select('id, name, deployed_version')
    .eq('id', processId)
    .single()

  const processRow = process as Record<string, unknown> | null
  const processName = (processRow?.['name'] as string) ?? 'Prozess'

  // Fetch requester profile
  const requestedById = deployRow['requested_by'] as string | null
  let requesterName = 'Unbekannt'
  if (requestedById) {
    const { data: requester } = await supabase
      .from('profiles')
      .select('display_name, first_name, last_name')
      .eq('id', requestedById)
      .single()
    if (requester) {
      const r = requester as Record<string, unknown>
      requesterName =
        (r['display_name'] as string | null) ??
        [r['first_name'], r['last_name']].filter(Boolean).join(' ') ??
        'Unbekannt'
    }
  }

  // Fetch reviewer profile if reviewed
  const reviewedById = deployRow['reviewed_by'] as string | null
  let reviewerName: string | null = null
  if (reviewedById) {
    const { data: reviewer } = await supabase
      .from('profiles')
      .select('display_name, first_name, last_name')
      .eq('id', reviewedById)
      .single()
    if (reviewer) {
      const r = reviewer as Record<string, unknown>
      reviewerName =
        (r['display_name'] as string | null) ??
        [r['first_name'], r['last_name']].filter(Boolean).join(' ') ??
        'Unbekannt'
    }
  }

  // Fetch version snapshots for diff
  const deployVersion = deployRow['version'] as string
  const deployedVersion = (processRow?.['deployed_version'] as string | null) ?? null

  let currentSnapshot: VersionSnapshot | null = null
  let newSnapshot: VersionSnapshot | null = null

  // Fetch the new version snapshot
  const { data: newVersionData } = await supabase
    .from('process_versions')
    .select('snapshot')
    .eq('process_id', processId)
    .eq('version', deployVersion)
    .single()

  if (newVersionData) {
    const nvRow = newVersionData as Record<string, unknown>
    newSnapshot = nvRow['snapshot'] as VersionSnapshot
  }

  // Fetch the currently deployed version snapshot (if exists)
  if (deployedVersion) {
    const { data: currentVersionData } = await supabase
      .from('process_versions')
      .select('snapshot')
      .eq('process_id', processId)
      .eq('version', deployedVersion)
      .single()

    if (currentVersionData) {
      const cvRow = currentVersionData as Record<string, unknown>
      currentSnapshot = cvRow['snapshot'] as VersionSnapshot
    }
  }

  const status = deployRow['status'] as string
  const isPending = status === 'pending_approval'
  const isRequester = requestedById === session.profile.id

  const statusConfig: Record<string, { label: string; classes: string }> = {
    pending_approval: { label: 'Freigabe ausstehend', classes: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    approved: { label: 'Freigegeben', classes: 'bg-blue-100 text-blue-800 border-blue-200' },
    rejected: { label: 'Abgelehnt', classes: 'bg-red-100 text-red-800 border-red-200' },
    deployed: { label: 'Deployed', classes: 'bg-green-100 text-green-800 border-green-200' },
    rolled_back: { label: 'Rollback', classes: 'bg-gray-100 text-gray-800 border-gray-200' },
  }
  const sc = statusConfig[status] ?? { label: status, classes: 'bg-gray-100 text-gray-600' }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-500" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/admin/processes/${processId}/deploy`} className="hover:text-gray-700">
              {processName}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-900 font-medium">Deployment v{deployVersion}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Deployment-Freigabe
          </h1>
          <p className="text-gray-500 mt-1">
            {processName} &mdash; v{deployVersion}
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${sc.classes}`}>
          {sc.label}
        </span>
      </div>

      {/* Metadata */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Beantragt von</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{requesterName}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(new Date(deployRow['requested_at'] as string))}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Neue Version</p>
          <p className="mt-1 text-sm font-mono font-medium text-gray-900">v{deployVersion}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Aktuelle Version</p>
          <p className="mt-1 text-sm font-mono font-medium text-gray-900">
            {deployedVersion ? `v${deployedVersion}` : 'Keine'}
          </p>
        </div>

        {reviewerName && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Geprueft von</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{reviewerName}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {deployRow['reviewed_at']
                ? formatDate(new Date(deployRow['reviewed_at'] as string))
                : ''}
            </p>
          </div>
        )}
      </div>

      {/* Reason */}
      {(deployRow['reason'] as string | null) && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Grund</p>
          <p className="text-sm text-gray-700">{deployRow['reason'] as string}</p>
        </div>
      )}

      {/* Review notes (if rejected or reviewed) */}
      {(deployRow['review_notes'] as string | null) && (
        <div className={`mb-6 rounded-lg border p-4 ${status === 'rejected' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
            {status === 'rejected' ? 'Ablehnungsgrund' : 'Anmerkungen'}
          </p>
          <p className="text-sm text-gray-700">{deployRow['review_notes'] as string}</p>
        </div>
      )}

      {/* Rollback info */}
      {(deployRow['rollback_of'] as string | null) && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-700 mb-1">
            Rollback
          </p>
          <p className="text-sm text-amber-800">
            Dieses Deployment ist ein Rollback eines vorherigen Deployments.
          </p>
        </div>
      )}

      {/* Diff viewer */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Aenderungen</h2>
        <DiffViewer
          currentSnapshot={currentSnapshot}
          newSnapshot={newSnapshot}
          currentVersion={deployedVersion}
          newVersion={deployVersion}
        />
      </div>

      {/* Approval controls */}
      {isPending && !isRequester && (
        <ApprovalControls
          deploymentId={deploymentId}
          processId={processId}
        />
      )}

      {/* Message for same-person check */}
      {isPending && isRequester && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Vier-Augen-Prinzip: Sie haben dieses Deployment beantragt und koennen es
            daher nicht selbst freigeben. Ein anderer Holding-Admin muss die Freigabe erteilen.
          </p>
        </div>
      )}
    </div>
  )
}
