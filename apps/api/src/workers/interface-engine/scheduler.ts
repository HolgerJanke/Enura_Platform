// =============================================================================
// Interface Scheduler — Enqueues execution jobs for active interfaces on schedule
// =============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../../lib/logger.js'
import type { InterfaceExecutionJobData } from './execution-worker.js'

// ---------------------------------------------------------------------------
// Service client
// ---------------------------------------------------------------------------

let _serviceClient: SupabaseClient | null = null

function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient

  _serviceClient = createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  return _serviceClient
}

// ---------------------------------------------------------------------------
// Types for DB rows
// ---------------------------------------------------------------------------

interface ActiveInterfaceRow {
  id: string
  holding_id: string
  company_id: string | null
  process_id: string
  step_id: string
  label: string
  sync_interval_min: number
}

interface DeployedProcessRow {
  process_id: string
  company_id: string
  holding_id: string
}

// ---------------------------------------------------------------------------
// Job callback type — the scheduler calls this to enqueue work
// ---------------------------------------------------------------------------

export type EnqueueFn = (
  job: InterfaceExecutionJobData,
  deduplicationKey: string,
) => Promise<void>

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches all active interfaces with sync_interval_min > 0 on deployed processes,
 * checks if the current minute is a multiple of the interval, and enqueues
 * execution jobs via the provided callback.
 *
 * Deduplication: Each job gets a key composed of interface ID + current time bucket
 * so that duplicate enqueues within the same interval window are ignored.
 *
 * @param enqueue - Callback to enqueue a job (provided by BullMQ queue wrapper)
 * @param now - Current timestamp (injectable for testing)
 */
export async function scheduleInterfaceExecutions(
  enqueue: EnqueueFn,
  now?: Date,
): Promise<void> {
  const client = getServiceClient()
  const currentTime = now ?? new Date()
  const currentMinute = currentTime.getUTCHours() * 60 + currentTime.getUTCMinutes()

  // 1. Fetch deployed processes (status = 'deployed')
  const { data: deployments, error: deployError } = await client
    .from('process_deployments')
    .select('process_id, company_id, holding_id')
    .eq('status', 'deployed')

  if (deployError) {
    logger.error({
      msg: 'Failed to fetch deployed processes for interface scheduling',
      error: deployError.message,
    })
    return
  }

  if (!deployments || deployments.length === 0) {
    logger.debug({ msg: 'No deployed processes found. Skipping interface scheduling.' })
    return
  }

  // Build a set of deployed process IDs and their company context
  const deployedMap = new Map<string, DeployedProcessRow>()
  for (const dep of deployments) {
    const row = dep as Record<string, unknown>
    const processId = row['process_id'] as string
    deployedMap.set(processId, {
      process_id: processId,
      company_id: row['company_id'] as string,
      holding_id: row['holding_id'] as string,
    })
  }

  // 2. Fetch all interfaces with sync_interval_min > 0
  const processIds = Array.from(deployedMap.keys())

  // Query in batches if many process IDs
  const { data: interfaces, error: ifaceError } = await client
    .from('process_step_interfaces')
    .select('id, holding_id, company_id, process_id, step_id, label, sync_interval_min')
    .in('process_id', processIds)
    .gt('sync_interval_min', 0)

  if (ifaceError) {
    logger.error({
      msg: 'Failed to fetch interfaces for scheduling',
      error: ifaceError.message,
    })
    return
  }

  if (!interfaces || interfaces.length === 0) {
    logger.debug({ msg: 'No schedulable interfaces found.' })
    return
  }

  // 3. Check each interface's interval and enqueue if due
  let scheduledCount = 0

  for (const raw of interfaces) {
    const iface = raw as unknown as ActiveInterfaceRow
    const interval = iface.sync_interval_min

    if (interval <= 0) continue

    // Check if current minute is a multiple of the interval
    if (currentMinute % interval !== 0) continue

    // Resolve the company_id: prefer interface-level, fall back to deployment-level
    const deployment = deployedMap.get(iface.process_id)
    if (!deployment) continue

    const companyId = iface.company_id ?? deployment.company_id
    const holdingId = iface.holding_id ?? deployment.holding_id

    // Build deduplication key: interfaceId + time bucket
    const timeBucket = Math.floor(currentTime.getTime() / (interval * 60_000))
    const deduplicationKey = `iface-exec:${iface.id}:${timeBucket}`

    const jobData: InterfaceExecutionJobData = {
      interfaceId: iface.id,
      holdingId,
      companyId,
      processId: iface.process_id,
      stepId: iface.step_id,
      trigger: 'scheduled',
    }

    try {
      await enqueue(jobData, deduplicationKey)
      scheduledCount++
    } catch (err) {
      logger.error({
        msg: 'Failed to enqueue interface execution job',
        interfaceId: iface.id,
        label: iface.label,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (scheduledCount > 0) {
    logger.info({
      msg: `Scheduled ${scheduledCount} interface execution(s)`,
      currentMinute,
    })
  }
}
