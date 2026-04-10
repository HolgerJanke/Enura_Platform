export interface ConnectorBase {
  readonly type: string
  readonly label: string
  readonly version: string

  validate(connector: ConnectorConfig): Promise<void>
  sync(companyId: string, connector: ConnectorConfig): Promise<SyncResult>
}

export type ConnectorConfig = {
  id: string
  company_id: string
  type: string
  credentials: Record<string, unknown>
  config: Record<string, unknown>
  last_synced_at: string | null
  sync_interval: number
  status: string
}

export type SyncResult = {
  success: boolean
  recordsFetched: number
  recordsWritten: number
  recordsSkipped: number
  errors: SyncError[]
  durationMs: number
}

export type SyncError = {
  code: string
  message: string
  context: Record<string, unknown>
}

export class ConnectorValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'ConnectorValidationError'
  }
}

export class ConnectorAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConnectorAuthError'
  }
}

export class ConnectorRateLimitError extends Error {
  constructor(
    public readonly retryAfterMs: number,
    message: string,
  ) {
    super(message)
    this.name = 'ConnectorRateLimitError'
  }
}
