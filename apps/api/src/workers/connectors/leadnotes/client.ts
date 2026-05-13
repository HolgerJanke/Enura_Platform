import { z } from 'zod'
import { ConnectorAuthError, ConnectorRateLimitError } from '../base.js'
import { LeadnotesLeadSchema, type LeadnotesLead, type LeadnotesCredentials } from './schemas.js'

export interface GetLeadsOptions {
  createdAfter?: string
  page?: number
  perPage?: number
}

export interface GetLeadsResult {
  leads: LeadnotesLead[]
  hasMore: boolean
  totalCount: number
}

/**
 * Leadnodes API v2 pagination response schema.
 * Uses standard Laravel paginator format: data + links + meta.
 */
const LeadnotesApiResponseSchema = z.object({
  data: z.array(LeadnotesLeadSchema),
  meta: z.object({
    total: z.number(),
    current_page: z.number(),
    per_page: z.number(),
    last_page: z.number(),
    from: z.number().nullable().optional(),
    to: z.number().nullable().optional(),
  }).passthrough(),
  links: z.object({
    first: z.string().nullable().optional(),
    last: z.string().nullable().optional(),
    prev: z.string().nullable().optional(),
    next: z.string().nullable().optional(),
  }).passthrough().optional(),
})

/**
 * Fetch leads from the Leadnotes API with pagination and incremental support.
 */
export async function getLeads(
  credentials: LeadnotesCredentials,
  opts?: GetLeadsOptions,
): Promise<GetLeadsResult> {
  const page = opts?.page ?? 1
  const perPage = opts?.perPage ?? 100

  const url = new URL('/api/v2/leads', credentials.base_url)
  url.searchParams.set('page', String(page))
  url.searchParams.set('per_page', String(perPage))

  if (opts?.createdAfter) {
    url.searchParams.set('created_after', opts.createdAfter)
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${credentials.api_key}`,
      Accept: 'application/json',
    },
  })

  if (response.status === 401 || response.status === 403) {
    throw new ConnectorAuthError(
      `Leadnotes auth error (${response.status}): Invalid API key`,
    )
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000
    throw new ConnectorRateLimitError(retryMs, 'Leadnotes rate limit exceeded')
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Leadnotes API error (${response.status}): ${errorText}`)
  }

  const raw: unknown = await response.json()
  const parsed = LeadnotesApiResponseSchema.parse(raw)

  return {
    leads: parsed.data,
    hasMore: parsed.meta.current_page < parsed.meta.last_page,
    totalCount: parsed.meta.total,
  }
}

/**
 * Fetch all leads since a given timestamp, handling pagination automatically.
 */
export async function fetchAllLeadsSince(
  credentials: LeadnotesCredentials,
  createdAfter: string | null,
): Promise<LeadnotesLead[]> {
  const allLeads: LeadnotesLead[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const opts: GetLeadsOptions = { page, perPage: 100 }
    if (createdAfter) opts.createdAfter = createdAfter
    const result = await getLeads(credentials, opts)

    allLeads.push(...result.leads)
    hasMore = result.hasMore
    page += 1
  }

  return allLeads
}
