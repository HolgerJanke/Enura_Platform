import { ConnectorAuthError } from '../base.js'

interface ThreeCXTokenResponse {
  Status: string
  Token: {
    pbx_version: string
    token_type: string
    expires_in: number
    access_token: string
    refresh_token: string
  } | null
  TwoFactorAuth: unknown
}

interface ODataResponse<T> {
  '@odata.context'?: string
  '@odata.count'?: number
  value: T[]
  '@odata.nextLink'?: string
}

export class ThreeCXApiClient {
  private readonly baseUrl: string
  private readonly username: string
  private readonly password: string
  private accessToken: string | null = null
  private tokenType = 'Bearer'
  private tokenExpiresAt = 0

  constructor(baseUrl: string, username: string, password: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.username = username
    this.password = password
  }

  private async authenticate(): Promise<void> {
    const url = `${this.baseUrl}/webclient/api/Login/GetAccessToken`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Username: this.username,
        Password: this.password,
      }),
    })

    if (!res.ok) {
      throw new ConnectorAuthError(
        `3CX auth failed: ${res.status} ${res.statusText}`,
      )
    }

    const data = (await res.json()) as ThreeCXTokenResponse
    if (data.Status !== 'AuthSuccess' || !data.Token) {
      throw new ConnectorAuthError(
        `3CX auth: ${data.Status} (no token)`,
      )
    }
    this.accessToken = data.Token.access_token
    this.tokenType = data.Token.token_type || 'Bearer'
    // Token expires_in is in seconds; refresh 10s early to be safe
    this.tokenExpiresAt = Date.now() + (data.Token.expires_in - 10) * 1000
  }

  private isTokenExpired(): boolean {
    return !this.accessToken || Date.now() >= this.tokenExpiresAt
  }

  private async request<T>(
    path: string,
    query?: Record<string, string>,
    retried = false,
  ): Promise<T> {
    if (this.isTokenExpired()) await this.authenticate()

    const url = new URL(`${this.baseUrl}${path}`)
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v)
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `${this.tokenType} ${this.accessToken}`,
        Accept: 'application/json',
      },
    })

    if ((res.status === 401 || res.status === 403) && !retried) {
      this.accessToken = null
      this.tokenExpiresAt = 0
      return this.request<T>(path, query, true)
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`3CX API ${res.status}: ${res.statusText} — ${body}`)
    }

    return (await res.json()) as T
  }

  /**
   * Fetches call recordings (which include full call metadata).
   * The Recordings endpoint is the most reliable source of call data
   * on 3CX Professional — CallHistoryView is user-scoped and often empty.
   */
  async getRecordings(opts: {
    top: number
    skip: number
    startDate?: string
  }): Promise<{ value: Record<string, unknown>[]; totalCount: number }> {
    const query: Record<string, string> = {
      $top: String(opts.top),
      $skip: String(opts.skip),
      $count: 'true',
      $orderby: 'StartTime desc',
    }

    if (opts.startDate) {
      query['$filter'] = `StartTime ge ${opts.startDate}`
    }

    const data = await this.request<ODataResponse<Record<string, unknown>>>(
      '/xapi/v1/Recordings',
      query,
    )

    return {
      value: data.value ?? [],
      totalCount: data['@odata.count'] ?? data.value?.length ?? 0,
    }
  }

  async getRecordingDownloadUrl(recId: string): Promise<string> {
    if (this.isTokenExpired()) await this.authenticate()
    return `${this.baseUrl}/xapi/v1/Recordings/Pbx.DownloadRecording(recId=${recId})?access_token=${this.accessToken}`
  }

  async getExtensions(): Promise<Record<string, unknown>[]> {
    const data = await this.request<ODataResponse<Record<string, unknown>>>(
      '/xapi/v1/Users',
    )
    return data.value ?? []
  }
}
