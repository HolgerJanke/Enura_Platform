import { HttpClient } from '../../../lib/http-client.js'
import type { ThreeCXCall, ThreeCXExtension } from './schemas.js'

export class ThreeCXApiClient {
  private readonly http: HttpClient

  constructor(baseUrl: string, apiKey: string) {
    this.http = new HttpClient({
      baseUrl,
      headers: { 'X-API-Key': apiKey },
    })
  }

  async getCallLog(opts: {
    page: number
    perPage: number
    startDate?: string
    endDate?: string
  }): Promise<{ data: ThreeCXCall[]; totalPages: number }> {
    const query: Record<string, string> = {
      page: String(opts.page),
      per_page: String(opts.perPage),
    }
    if (opts.startDate) query['start_date'] = opts.startDate
    if (opts.endDate) query['end_date'] = opts.endDate
    return this.http.get('/api/v1/calls', query)
  }

  async getRecordingUrl(callId: string): Promise<string> {
    const result = await this.http.get<{ url: string }>(
      `/api/v1/calls/${encodeURIComponent(callId)}/recording`,
    )
    return result.url
  }

  async getExtensions(): Promise<ThreeCXExtension[]> {
    return this.http.get<ThreeCXExtension[]>('/api/v1/extensions')
  }
}
