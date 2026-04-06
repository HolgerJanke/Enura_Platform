import { HttpClient } from '../../../lib/http-client.js'
import type { ReonicUser, ReonicLead, ReonicOffer } from './schemas.js'

export class ReonicApiClient {
  private readonly http: HttpClient

  constructor(baseUrl: string, apiKey: string) {
    this.http = new HttpClient({
      baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  }

  async getUsers(): Promise<ReonicUser[]> {
    return this.http.get<ReonicUser[]>('/api/v1/users')
  }

  async getLeads(opts: {
    page: number
    perPage: number
    updatedSince?: string
  }): Promise<{ data: ReonicLead[]; totalPages: number }> {
    const query: Record<string, string> = {
      page: String(opts.page),
      per_page: String(opts.perPage),
    }
    if (opts.updatedSince) query['updated_since'] = opts.updatedSince
    return this.http.get('/api/v1/leads', query)
  }

  async getOffers(opts: {
    page: number
    perPage: number
    updatedSince?: string
  }): Promise<{ data: ReonicOffer[]; totalPages: number }> {
    const query: Record<string, string> = {
      page: String(opts.page),
      per_page: String(opts.perPage),
    }
    if (opts.updatedSince) query['updated_since'] = opts.updatedSince
    return this.http.get('/api/v1/offers', query)
  }
}
