'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestDeploymentInput {
  processId: string
  holdingId: string
  companyId: string
  version: string
  reason?: string
}

interface ActionResult {
  success: boolean
  error?: string
  deploymentId?: string
}

// ---------------------------------------------------------------------------
// requestDeploymentAction
// Creates a deployment record with status='pending_approval' and writes audit log.
// ---------------------------------------------------------------------------

export async function requestDeploymentAction(
  input: RequestDeploymentInput,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Nicht authentifiziert.' }
  if (!session.isHoldingAdmin) {
    return { success: false, error: 'Keine Berechtigung.' }
  }

  const supabase = createSupabaseServerClient()

  // Verify the process exists
  const { data: process } = await supabase
    .from('process_definitions')
    .select('id, holding_id, version')
    .eq('id', input.processId)
    .single()

  if (!process) {
    return { success: false, error: 'Prozess nicht gefunden.' }
  }

  // Create the deployment record
  const { data: deployment, error: deployError } = await supabase
    .from('process_deployments')
    .insert({
      holding_id: input.holdingId,
      company_id: input.companyId,
      process_id: input.processId,
      version: input.version,
      status: 'pending_approval',
      requested_by: session.profile.id,
      reason: input.reason ?? null,
    })
    .select('id')
    .single()

  if (deployError || !deployment) {
    return {
      success: false,
      error: 'Deployment konnte nicht erstellt werden.',
    }
  }

  const deploymentRow = deployment as Record<string, unknown>
  const deploymentId = deploymentRow['id'] as string

  // Write audit log entry
  await supabase.from('audit_log').insert({
    holding_id: input.holdingId,
    company_id: input.companyId,
    profile_id: session.profile.id,
    action: 'process_deployment_requested',
    entity_type: 'process_deployment',
    entity_id: deploymentId,
    details: {
      process_id: input.processId,
      version: input.version,
      reason: input.reason ?? null,
    },
  })

  revalidatePath(`/admin/processes/${input.processId}/deploy`)
  revalidatePath(`/admin/processes/${input.processId}/versions`)

  return { success: true, deploymentId }
}

// ---------------------------------------------------------------------------
// approveDeploymentAction
// Sets status='approved', triggers deployment, updates process definition.
// ---------------------------------------------------------------------------

interface ApproveDeploymentInput {
  deploymentId: string
  processId: string
  notes?: string
}

export async function approveDeploymentAction(
  input: ApproveDeploymentInput,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Nicht authentifiziert.' }
  if (!session.isHoldingAdmin) {
    return { success: false, error: 'Keine Berechtigung.' }
  }

  const supabase = createSupabaseServerClient()

  // Fetch the deployment
  const { data: deployment } = await supabase
    .from('process_deployments')
    .select('id, process_id, version, status, requested_by, holding_id, company_id')
    .eq('id', input.deploymentId)
    .single()

  if (!deployment) {
    return { success: false, error: 'Deployment nicht gefunden.' }
  }

  const deployRow = deployment as Record<string, unknown>

  if ((deployRow['status'] as string) !== 'pending_approval') {
    return {
      success: false,
      error: 'Deployment ist nicht im Status "ausstehend".',
    }
  }

  // Two-eyes principle: reviewer must be different from requester
  if ((deployRow['requested_by'] as string) === session.profile.id) {
    return {
      success: false,
      error:
        'Vier-Augen-Prinzip: Der Antragsteller kann nicht gleichzeitig freigeben.',
    }
  }

  const now = new Date().toISOString()

  // Update deployment status to approved and then deployed
  const { error: updateError } = await supabase
    .from('process_deployments')
    .update({
      status: 'deployed',
      reviewed_by: session.profile.id,
      reviewed_at: now,
      review_notes: input.notes ?? null,
      deployed_at: now,
    })
    .eq('id', input.deploymentId)

  if (updateError) {
    return { success: false, error: 'Freigabe konnte nicht gespeichert werden.' }
  }

  // Update the process definition to reflect deployment
  await supabase
    .from('process_definitions')
    .update({
      status: 'deployed',
      deployed_version: deployRow['version'] as string,
      deployed_at: now,
      company_id: deployRow['company_id'] as string,
    })
    .eq('id', deployRow['process_id'] as string)

  // Audit log
  await supabase.from('audit_log').insert({
    holding_id: deployRow['holding_id'] as string,
    company_id: deployRow['company_id'] as string,
    profile_id: session.profile.id,
    action: 'process_deployment_approved',
    entity_type: 'process_deployment',
    entity_id: input.deploymentId,
    details: {
      process_id: deployRow['process_id'] as string,
      version: deployRow['version'] as string,
      notes: input.notes ?? null,
    },
  })

  revalidatePath(`/admin/processes/${input.processId}/deploy`)
  revalidatePath(`/admin/processes/${input.processId}/deployments/${input.deploymentId}`)

  return { success: true, deploymentId: input.deploymentId }
}

// ---------------------------------------------------------------------------
// rejectDeploymentAction
// Sets status='rejected', notifies requester.
// ---------------------------------------------------------------------------

interface RejectDeploymentInput {
  deploymentId: string
  processId: string
  reason: string
}

export async function rejectDeploymentAction(
  input: RejectDeploymentInput,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Nicht authentifiziert.' }
  if (!session.isHoldingAdmin) {
    return { success: false, error: 'Keine Berechtigung.' }
  }

  if (!input.reason.trim()) {
    return {
      success: false,
      error: 'Bitte geben Sie einen Ablehnungsgrund an.',
    }
  }

  const supabase = createSupabaseServerClient()

  // Fetch the deployment
  const { data: deployment } = await supabase
    .from('process_deployments')
    .select('id, process_id, version, status, holding_id, company_id, requested_by')
    .eq('id', input.deploymentId)
    .single()

  if (!deployment) {
    return { success: false, error: 'Deployment nicht gefunden.' }
  }

  const deployRow = deployment as Record<string, unknown>

  if ((deployRow['status'] as string) !== 'pending_approval') {
    return {
      success: false,
      error: 'Deployment ist nicht im Status "ausstehend".',
    }
  }

  const now = new Date().toISOString()

  // Update deployment status
  const { error: updateError } = await supabase
    .from('process_deployments')
    .update({
      status: 'rejected',
      reviewed_by: session.profile.id,
      reviewed_at: now,
      review_notes: input.reason,
    })
    .eq('id', input.deploymentId)

  if (updateError) {
    return { success: false, error: 'Ablehnung konnte nicht gespeichert werden.' }
  }

  // Update process status back to finalised
  await supabase
    .from('process_definitions')
    .update({ status: 'finalised' })
    .eq('id', deployRow['process_id'] as string)

  // Audit log
  await supabase.from('audit_log').insert({
    holding_id: deployRow['holding_id'] as string,
    company_id: deployRow['company_id'] as string,
    profile_id: session.profile.id,
    action: 'process_deployment_rejected',
    entity_type: 'process_deployment',
    entity_id: input.deploymentId,
    details: {
      process_id: deployRow['process_id'] as string,
      version: deployRow['version'] as string,
      reason: input.reason,
    },
  })

  revalidatePath(`/admin/processes/${input.processId}/deploy`)
  revalidatePath(`/admin/processes/${input.processId}/deployments/${input.deploymentId}`)

  return { success: true, deploymentId: input.deploymentId }
}

// ---------------------------------------------------------------------------
// rollbackDeploymentAction
// Creates a new deployment record with rollback_of referencing the original.
// ---------------------------------------------------------------------------

interface RollbackDeploymentInput {
  deploymentId: string
  processId: string
  targetVersion: string
  reason?: string
}

export async function rollbackDeploymentAction(
  input: RollbackDeploymentInput,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Nicht authentifiziert.' }
  if (!session.isHoldingAdmin) {
    return { success: false, error: 'Keine Berechtigung.' }
  }

  const supabase = createSupabaseServerClient()

  // Fetch the original deployment
  const { data: originalDeployment } = await supabase
    .from('process_deployments')
    .select('id, process_id, version, holding_id, company_id, status')
    .eq('id', input.deploymentId)
    .single()

  if (!originalDeployment) {
    return { success: false, error: 'Ursprüngliches Deployment nicht gefunden.' }
  }

  const origRow = originalDeployment as Record<string, unknown>

  // Mark original as rolled back
  await supabase
    .from('process_deployments')
    .update({ status: 'rolled_back' })
    .eq('id', input.deploymentId)

  // Create new rollback deployment
  const { data: rollbackDeployment, error: insertError } = await supabase
    .from('process_deployments')
    .insert({
      holding_id: origRow['holding_id'] as string,
      company_id: origRow['company_id'] as string,
      process_id: input.processId,
      version: input.targetVersion,
      status: 'pending_approval',
      requested_by: session.profile.id,
      reason: input.reason ?? `Rollback von v${origRow['version'] as string}`,
      rollback_of: input.deploymentId,
    })
    .select('id')
    .single()

  if (insertError || !rollbackDeployment) {
    return { success: false, error: 'Rollback konnte nicht erstellt werden.' }
  }

  const rollbackRow = rollbackDeployment as Record<string, unknown>
  const rollbackId = rollbackRow['id'] as string

  // Audit log
  await supabase.from('audit_log').insert({
    holding_id: origRow['holding_id'] as string,
    company_id: origRow['company_id'] as string,
    profile_id: session.profile.id,
    action: 'process_deployment_rollback_requested',
    entity_type: 'process_deployment',
    entity_id: rollbackId,
    details: {
      process_id: input.processId,
      original_deployment_id: input.deploymentId,
      original_version: origRow['version'] as string,
      target_version: input.targetVersion,
      reason: input.reason ?? null,
    },
  })

  revalidatePath(`/admin/processes/${input.processId}/deploy`)
  revalidatePath(`/admin/processes/${input.processId}/versions`)

  return { success: true, deploymentId: rollbackId }
}
