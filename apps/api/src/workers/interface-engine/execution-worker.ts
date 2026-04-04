// =============================================================================
// Interface Execution Worker — Generic BullMQ worker that executes HTTP
// requests based on process_step_interfaces configuration
// =============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ProcessStepInterfaceRow } from '@enura/types'
import { loadSecretValue } from '../../lib/secrets.js'
import { logger } from '../../lib/logger.js'
import { buildRequestFromSchema } from './request-builder.js'
import { validateResponseSchema } from './response-validator.js'
import { applyFieldMapping, type FieldMappingResult } from './field-mapper.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKER_CONCURRENCY = 10
const MAX_RETRIES_EXPONENTIAL = 3
const BASE_BACKOFF_MS = 2_000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InterfaceExecutionJobData {
  interfaceId: string
  holdingId: string
  companyId: string
  processId: string
  stepId: string
  trigger: 'scheduled' | 'manual' | 'webhook'
  variables?: Record<string, string>
}

interface ExecutionLogEntry {
  interface_id: string
  holding_id: string
  company_id: string
  process_id: string
  step_id: string
  trigger: string
  status: 'success' | 'error' | 'anomaly_created'
  http_status: number | null
  request_url: string | null
  duration_ms: number
  response_summary: Record<string, unknown> | null
  field_mapping_results: FieldMappingResult[] | null
  error_message: string | null
  attempt: number
  executed_at: string
}

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
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadInterfaceConfig(
  interfaceId: string,
): Promise<ProcessStepInterfaceRow | null> {
  const client = getServiceClient()

  const { data, error } = await client
    .from('process_step_interfaces')
    .select('*')
    .eq('id', interfaceId)
    .single()

  if (error || !data) {
    logger.error({
      msg: 'Failed to load interface config',
      interfaceId,
      error: error?.message,
    })
    return null
  }

  return data as unknown as ProcessStepInterfaceRow
}

async function writeExecutionLog(entry: ExecutionLogEntry): Promise<void> {
  const client = getServiceClient()

  const { error } = await client
    .from('interface_execution_log')
    .insert(entry)

  if (error) {
    logger.error({
      msg: 'Failed to write interface execution log',
      interfaceId: entry.interface_id,
      error: error.message,
    })
  }
}

async function createAnomalyForFailure(
  job: InterfaceExecutionJobData,
  config: ProcessStepInterfaceRow,
  errorMessage: string,
): Promise<void> {
  const client = getServiceClient()

  const { error } = await client.from('anomalies').insert({
    company_id: job.companyId,
    type: 'interface_execution_failure',
    severity: 'high',
    entity_id: job.interfaceId,
    entity_name: config.label,
    metric: 'interface_health',
    current_value: 0,
    baseline_value: 1,
    deviation_pct: -100,
    message: `Interface "${config.label}" failed and requires manual intervention: ${errorMessage}`,
    is_active: true,
    notified: false,
  })

  if (error) {
    logger.error({
      msg: 'Failed to create anomaly for interface failure',
      interfaceId: job.interfaceId,
      error: error.message,
    })
  }
}

async function executeHttpRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: Record<string, unknown> | null,
  timeoutSec: number,
): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000)

  const fetchOpts: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  }

  if (body !== null) {
    fetchOpts.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, fetchOpts)
    clearTimeout(timeoutId)

    const contentType = response.headers.get('content-type') ?? ''
    let data: unknown

    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    if (!response.ok) {
      throw new HttpExecutionError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        data,
      )
    }

    return { status: response.status, data }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof HttpExecutionError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new HttpExecutionError(
        `Request timed out after ${timeoutSec}s`,
        0,
        null,
      )
    }
    throw err
  }
}

class HttpExecutionError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly responseData: unknown,
  ) {
    super(message)
    this.name = 'HttpExecutionError'
  }
}

// ---------------------------------------------------------------------------
// Main execution logic
// ---------------------------------------------------------------------------

async function executeInterface(
  job: InterfaceExecutionJobData,
): Promise<void> {
  const startTime = Date.now()

  // 1. Load interface config
  const config = await loadInterfaceConfig(job.interfaceId)
  if (!config) {
    throw new Error(`Interface config not found: ${job.interfaceId}`)
  }

  if (!config.endpoint) {
    throw new Error(`Interface "${config.label}" has no endpoint configured.`)
  }

  if (!config.http_method) {
    throw new Error(`Interface "${config.label}" has no HTTP method configured.`)
  }

  // 2. Load secret if referenced
  let secretValue: string | null = null
  if (config.secret_ref) {
    secretValue = await loadSecretValue(
      job.holdingId,
      config.secret_ref,
      `Interface execution: ${config.label} (${job.interfaceId})`,
    )
  }

  // 3. Build HTTP request
  const variables = job.variables ?? {}
  const builtRequest = buildRequestFromSchema({
    endpoint: config.endpoint,
    httpMethod: config.http_method,
    requestSchema: config.request_schema,
    secretValue,
    variables,
  })

  // 4. Determine retry behaviour
  const maxAttempts =
    config.retry_policy === 'exponential_3x'
      ? MAX_RETRIES_EXPONENTIAL
      : config.retry_policy === 'alert_manual'
        ? 1
        : 1

  let lastError: Error | null = null
  let httpStatus: number | null = null
  let responseData: unknown = null

  // 5. Execute with retries
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 2)
      logger.info({
        msg: `Retrying interface execution`,
        interfaceId: job.interfaceId,
        attempt,
        backoffMs,
      })
      await sleep(backoffMs)
    }

    try {
      const result = await executeHttpRequest(
        builtRequest.url,
        builtRequest.method,
        builtRequest.headers,
        builtRequest.body,
        config.timeout_sec,
      )

      httpStatus = result.status
      responseData = result.data
      lastError = null
      break
    } catch (err) {
      if (err instanceof HttpExecutionError) {
        httpStatus = err.httpStatus
        responseData = err.responseData
      }
      lastError = err instanceof Error ? err : new Error(String(err))

      logger.warn({
        msg: 'Interface execution attempt failed',
        interfaceId: job.interfaceId,
        attempt,
        maxAttempts,
        error: lastError.message,
      })
    }
  }

  const durationMs = Date.now() - startTime

  // 6. Handle final failure
  if (lastError) {
    // For alert_manual policy: create anomaly instead of further retries
    if (config.retry_policy === 'alert_manual') {
      await createAnomalyForFailure(job, config, lastError.message)

      await writeExecutionLog({
        interface_id: job.interfaceId,
        holding_id: job.holdingId,
        company_id: job.companyId,
        process_id: job.processId,
        step_id: job.stepId,
        trigger: job.trigger,
        status: 'anomaly_created',
        http_status: httpStatus,
        request_url: builtRequest.url,
        duration_ms: durationMs,
        response_summary: responseData !== null
          ? { raw: typeof responseData === 'string' ? responseData.slice(0, 500) : responseData }
          : null,
        field_mapping_results: null,
        error_message: lastError.message,
        attempt: 1,
        executed_at: new Date().toISOString(),
      })

      return
    }

    // All retries exhausted — log error
    await writeExecutionLog({
      interface_id: job.interfaceId,
      holding_id: job.holdingId,
      company_id: job.companyId,
      process_id: job.processId,
      step_id: job.stepId,
      trigger: job.trigger,
      status: 'error',
      http_status: httpStatus,
      request_url: builtRequest.url,
      duration_ms: durationMs,
      response_summary: responseData !== null
        ? { raw: typeof responseData === 'string' ? responseData.slice(0, 500) : responseData }
        : null,
      field_mapping_results: null,
      error_message: lastError.message,
      attempt: maxAttempts,
      executed_at: new Date().toISOString(),
    })

    throw lastError
  }

  // 7. Validate response schema (if defined)
  if (config.response_schema) {
    try {
      validateResponseSchema(responseData, config.response_schema)
    } catch (validationErr) {
      const errMsg = validationErr instanceof Error ? validationErr.message : String(validationErr)

      await writeExecutionLog({
        interface_id: job.interfaceId,
        holding_id: job.holdingId,
        company_id: job.companyId,
        process_id: job.processId,
        step_id: job.stepId,
        trigger: job.trigger,
        status: 'error',
        http_status: httpStatus,
        request_url: builtRequest.url,
        duration_ms: Date.now() - startTime,
        response_summary: { raw: typeof responseData === 'string' ? responseData.slice(0, 500) : responseData },
        field_mapping_results: null,
        error_message: `Response validation failed: ${errMsg}`,
        attempt: maxAttempts,
        executed_at: new Date().toISOString(),
      })

      throw new Error(`Response validation failed: ${errMsg}`)
    }
  }

  // 8. Apply field mappings
  let mappingResults: FieldMappingResult[] | null = null

  if (config.field_mapping && config.field_mapping.length > 0) {
    mappingResults = await applyFieldMapping(
      responseData,
      config.field_mapping,
      job.companyId,
    )

    const failedMappings = mappingResults.filter((r) => !r.success)
    if (failedMappings.length > 0) {
      logger.warn({
        msg: 'Some field mappings failed',
        interfaceId: job.interfaceId,
        failedCount: failedMappings.length,
        totalCount: mappingResults.length,
        failures: failedMappings.map((f) => ({
          table: f.table,
          column: f.column,
          error: f.error,
        })),
      })
    }
  }

  // 9. Log successful execution
  await writeExecutionLog({
    interface_id: job.interfaceId,
    holding_id: job.holdingId,
    company_id: job.companyId,
    process_id: job.processId,
    step_id: job.stepId,
    trigger: job.trigger,
    status: 'success',
    http_status: httpStatus,
    request_url: builtRequest.url,
    duration_ms: Date.now() - startTime,
    response_summary: responseData !== null
      ? { raw: typeof responseData === 'string' ? responseData.slice(0, 500) : responseData }
      : null,
    field_mapping_results: mappingResults,
    error_message: null,
    attempt: 1,
    executed_at: new Date().toISOString(),
  })

  logger.info({
    msg: 'Interface execution completed',
    interfaceId: job.interfaceId,
    label: config.label,
    httpStatus,
    durationMs: Date.now() - startTime,
    mappingsApplied: mappingResults?.length ?? 0,
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export { WORKER_CONCURRENCY }

/**
 * Process a single interface execution job.
 * Called by BullMQ Worker or directly for testing.
 */
export async function processInterfaceExecution(
  job: InterfaceExecutionJobData,
): Promise<void> {
  logger.info({
    msg: 'Starting interface execution',
    interfaceId: job.interfaceId,
    companyId: job.companyId,
    trigger: job.trigger,
  })

  try {
    await executeInterface(job)
  } catch (err) {
    logger.error({
      msg: 'Interface execution failed',
      interfaceId: job.interfaceId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
