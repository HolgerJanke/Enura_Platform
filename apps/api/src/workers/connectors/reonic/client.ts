import { HttpClient } from '../../../lib/http-client.js'
import type { ReonicUser, ReonicLead, ReonicOffer } from './schemas.js'

// ---------------------------------------------------------------------------
// Reonic REST API v2
// Base URL:  https://api.reonic.de/rest/v2
// Auth:      x-authorization header (NOT Bearer)
// Docs:      https://api.reonic.de/rest/v2/docs
// ---------------------------------------------------------------------------

const REONIC_BASE_URL = 'https://api.reonic.de/rest/v2/'

type PagedResponse<T> = { content: T[]; totalPages: number; totalElements: number }
// h360/offers returns { results: [...], hasNextPage: boolean }
type ResultsResponse<T> = { results: T[]; hasNextPage?: boolean; totalPages?: number }

function unwrapPaged<T>(
  raw: T[] | PagedResponse<T> | ResultsResponse<T>,
): { data: T[]; totalPages: number; hasNextPage?: boolean } {
  if (Array.isArray(raw)) return { data: raw, totalPages: 1 }
  if ('results' in raw) {
    const r = raw as ResultsResponse<T>
    return { data: r.results ?? [], totalPages: r.totalPages ?? 1, hasNextPage: r.hasNextPage }
  }
  const p = raw as PagedResponse<T>
  return { data: p.content ?? [], totalPages: p.totalPages ?? 1 }
}

export class ReonicApiClient {
  private readonly http: HttpClient
  private readonly clientId: string

  /**
   * @param apiKey   – Reonic API key (sent as `x-authorization` header)
   * @param clientId – Reonic client UUID (appears in every path: /clients/{clientId}/...)
   */
  constructor(apiKey: string, clientId: string) {
    this.http = new HttpClient({
      baseUrl: REONIC_BASE_URL,
      // Reonic v2 uses x-authorization, NOT Authorization: Bearer
      headers: { 'x-authorization': apiKey },
    })
    this.clientId = clientId
  }

  /** GET /clients/{clientId}/users — team members */
  async getUsers(): Promise<ReonicUser[]> {
    const raw = await this.http.get<ReonicUser[] | PagedResponse<ReonicUser>>(
      `/clients/${this.clientId}/users`,
    )
    return Array.isArray(raw) ? raw : (raw.content ?? [])
  }

  /** GET /clients/{clientId}/contacts — leads/contacts (paginated, incremental) */
  async getLeads(opts: {
    page: number
    perPage: number
    updatedSince?: string
  }): Promise<{ data: ReonicLead[]; totalPages: number }> {
    const query: Record<string, string> = {
      page: String(opts.page - 1), // Reonic v2 is 0-indexed
      size: String(opts.perPage),
    }
    if (opts.updatedSince) query['updated_from'] = opts.updatedSince
    const raw = await this.http.get<ReonicLead[] | PagedResponse<ReonicLead>>(
      `/clients/${this.clientId}/contacts`,
      query,
    )
    return unwrapPaged(raw)
  }

  /** GET /clients/{clientId}/h360/offers — residential solar offers
   *  NOTE: h360/offers only accepts `page` (0-indexed, 100 per page).
   *  Does NOT accept `size` or `updated_from` query params.
   *  Response: { results: [...], hasNextPage: boolean }
   */
  async getOffers(opts: {
    page: number
    perPage: number
    updatedSince?: string // ignored — h360/offers doesn't support incremental
  }): Promise<{ data: ReonicOffer[]; totalPages: number; hasNextPage?: boolean }> {
    // h360/offers only accepts `page` — no size, no updated_from
    const query: Record<string, string> = {
      page: String(opts.page - 1),
    }
    const raw = await this.http.get<ResultsResponse<ReonicOffer>>(
      `/clients/${this.clientId}/h360/offers`,
      query,
    )
    return unwrapPaged(raw)
  }

  /**
   * GET /clients/{clientId}/activities/status?from=&to=
   * Delta-sync endpoint — returns only changed activities in a time window.
   * More efficient than polling all contacts/offers on every sync run.
   */
  async getActivityStatus(from: string, to: string): Promise<unknown[]> {
    const raw = await this.http.get<unknown[] | PagedResponse<unknown>>(
      `/clients/${this.clientId}/activities/status`,
      { from, to },
    )
    return Array.isArray(raw) ? raw : (raw.content ?? [])
  }

  /** GET /clients/{clientId}/calendar-events — appointments and site visits */
  async getCalendarEvents(opts: { page?: number; size?: number } = {}): Promise<unknown[]> {
    const query: Record<string, string> = {
      page: String(opts.page ?? 0),
      size: String(opts.size ?? 100),
    }
    const raw = await this.http.get<unknown[] | PagedResponse<unknown>>(
      `/clients/${this.clientId}/calendar-events`,
      query,
    )
    return Array.isArray(raw) ? raw : (raw.content ?? [])
  }

  /** GET /clients/{clientId}/checklist/by-parent-entity/{offerId}/h360 — Arbeitsheft */
  async getChecklist(offerId: string): Promise<unknown[]> {
    const raw = await this.http.get<unknown[] | PagedResponse<unknown>>(
      `/clients/${this.clientId}/checklist/by-parent-entity/${offerId}/h360`,
    )
    return Array.isArray(raw) ? raw : (raw.content ?? [])
  }
}
