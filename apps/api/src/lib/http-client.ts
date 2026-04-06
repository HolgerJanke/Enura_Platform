import { ConnectorAuthError, ConnectorRateLimitError } from '../workers/connectors/base.js'

export interface HttpClientOptions {
  baseUrl: string
  headers?: Record<string, string>
  timeoutMs?: number
  maxRetries?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export class HttpClient {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>
  private readonly timeoutMs: number
  private readonly maxRetries: number

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl
    this.headers = opts.headers ?? {}
    this.timeoutMs = opts.timeoutMs ?? 30_000
    this.maxRetries = opts.maxRetries ?? 3
  }

  async get<T>(path: string, query?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, query)
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 30_000)
        await sleep(backoffMs)
      }

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)
        const fetchOpts: RequestInit = {
          method,
          headers: { 'Content-Type': 'application/json', ...this.headers },
          signal: controller.signal,
        }
        if (body) {
          fetchOpts.body = JSON.stringify(body)
        }
        const response = await fetch(url.toString(), fetchOpts)
        clearTimeout(timeoutId)

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10)
          throw new ConnectorRateLimitError(retryAfter * 1000, 'Rate limit exceeded')
        }

        if (response.status === 401 || response.status === 403) {
          throw new ConnectorAuthError(`Auth failed: ${response.status} ${response.statusText}`)
        }

        if (response.status >= 500) {
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
          continue
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return (await response.json()) as T
      } catch (err) {
        if (err instanceof ConnectorAuthError || err instanceof ConnectorRateLimitError) {
          throw err
        }
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }

    throw lastError ?? new Error('Max retries exceeded')
  }
}
