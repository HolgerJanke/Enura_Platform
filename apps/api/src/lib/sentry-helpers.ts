import * as Sentry from '@sentry/node'

const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'key',
  'api_key',
  'access_token',
  'refresh_token',
])

/**
 * Recursively redacts sensitive fields from an object.
 * Returns a new object with sensitive values replaced by '[REDACTED]'.
 */
function redactSensitiveFields(
  data: Record<string, unknown>
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {}

  for (const [fieldKey, value] of Object.entries(data)) {
    const lowerKey = fieldKey.toLowerCase()

    if (SENSITIVE_KEYS.has(lowerKey)) {
      redacted[fieldKey] = '[REDACTED]'
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      redacted[fieldKey] = redactSensitiveFields(
        value as Record<string, unknown>
      )
    } else {
      redacted[fieldKey] = value
    }
  }

  return redacted
}

/**
 * Captures a worker error in Sentry with appropriate tags and redacted job data.
 *
 * @param error - The error to capture
 * @param workerName - Name of the BullMQ worker (e.g. 'reonic-sync', '3cx-sync')
 * @param jobData - Raw job payload; sensitive fields will be redacted before sending
 */
export function captureWorkerError(
  error: Error,
  workerName: string,
  jobData?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    scope.setTag('worker_type', workerName)
    scope.setTag('environment', process.env.NODE_ENV ?? 'unknown')

    if (jobData) {
      scope.setExtra('job_data', redactSensitiveFields(jobData))
    }

    Sentry.captureException(error)
  })
}
