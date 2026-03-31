import { createClient } from '@supabase/supabase-js'
import type { ConnectorBase, ConnectorConfig, SyncResult, SyncError } from '../base.js'
import { ConnectorRateLimitError } from '../base.js'
import { upsertRecords } from '../upsert.js'
import { getBexioAccessToken } from './oauth.js'
import { getInvoices, getInvoicePayments } from './client.js'
import { normaliseInvoice, normalisePayment } from './normalise.js'
import type { BexioInvoice } from './schemas.js'

const RATE_LIMIT_DELAY_MS = 300
const PAGE_SIZE = 100

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Sleep for a given number of milliseconds to respect rate limits.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch all invoices with pagination, stopping when we hit records
 * older than the last sync timestamp (incremental sync).
 */
async function fetchAllInvoices(
  accessToken: string,
  lastSyncedAt: string | null,
): Promise<{ invoices: BexioInvoice[]; errors: SyncError[] }> {
  const invoices: BexioInvoice[] = []
  const errors: SyncError[] = []
  let offset = 0
  let hasMore = true

  const cutoff = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0

  while (hasMore) {
    try {
      const page = await getInvoices(accessToken, { offset, limit: PAGE_SIZE })

      if (page.length === 0) {
        hasMore = false
        break
      }

      // Check if we have reached invoices older than the last sync
      let reachedCutoff = false
      for (const invoice of page) {
        const updatedAt = new Date(invoice.updated_at).getTime()
        if (cutoff > 0 && updatedAt < cutoff) {
          reachedCutoff = true
          break
        }
        invoices.push(invoice)
      }

      if (reachedCutoff || page.length < PAGE_SIZE) {
        hasMore = false
      } else {
        offset += PAGE_SIZE
      }

      await sleep(RATE_LIMIT_DELAY_MS)
    } catch (err) {
      if (err instanceof ConnectorRateLimitError) {
        await sleep(err.retryAfterMs)
        continue
      }
      errors.push({
        code: 'BEXIO_FETCH_INVOICES',
        message: err instanceof Error ? err.message : String(err),
        context: { offset },
      })
      hasMore = false
    }
  }

  return { invoices, errors }
}

/**
 * Look up the internal invoice UUID by external_id and company_id.
 */
async function resolveInvoiceId(
  companyId: string,
  externalId: string,
): Promise<string | null> {
  const db = getServiceClient()
  const { data } = await db
    .from('invoices')
    .select('id')
    .eq('company_id', companyId)
    .eq('external_id', externalId)
    .single()

  return data?.id ?? null
}

/**
 * Sync payments for a list of recently updated invoices.
 */
async function syncPayments(
  accessToken: string,
  companyId: string,
  invoices: BexioInvoice[],
): Promise<{ written: number; errors: SyncError[] }> {
  let totalWritten = 0
  const allErrors: SyncError[] = []

  for (const invoice of invoices) {
    try {
      const payments = await getInvoicePayments(accessToken, invoice.id)

      if (payments.length === 0) {
        await sleep(RATE_LIMIT_DELAY_MS)
        continue
      }

      const internalInvoiceId = await resolveInvoiceId(companyId, String(invoice.id))
      if (!internalInvoiceId) {
        await sleep(RATE_LIMIT_DELAY_MS)
        continue
      }

      const normalised = payments.map((p) =>
        normalisePayment(companyId, internalInvoiceId, p),
      )

      const result = await upsertRecords(
        'payments',
        normalised as unknown as Record<string, unknown>[],
        ['company_id', 'reference'],
      )

      totalWritten += result.written
      allErrors.push(...result.errors)

      await sleep(RATE_LIMIT_DELAY_MS)
    } catch (err) {
      if (err instanceof ConnectorRateLimitError) {
        await sleep(err.retryAfterMs)
        continue
      }
      allErrors.push({
        code: 'BEXIO_FETCH_PAYMENTS',
        message: err instanceof Error ? err.message : String(err),
        context: { bexioInvoiceId: invoice.id },
      })
    }
  }

  return { written: totalWritten, errors: allErrors }
}

export const bexioConnector: ConnectorBase = {
  type: 'bexio',
  label: 'Bexio Accounting',
  version: '1.0.0',

  async validate(connector: ConnectorConfig): Promise<void> {
    // Validates that we can obtain a working access token
    await getBexioAccessToken(connector)
  },

  async sync(companyId: string, connector: ConnectorConfig): Promise<SyncResult> {
    const startTime = Date.now()
    const errors: SyncError[] = []
    let recordsFetched = 0
    let recordsWritten = 0
    let recordsSkipped = 0

    try {
      const accessToken = await getBexioAccessToken(connector)

      // 1. Sync invoices (incremental)
      const { invoices, errors: fetchErrors } = await fetchAllInvoices(
        accessToken,
        connector.last_synced_at,
      )
      errors.push(...fetchErrors)
      recordsFetched += invoices.length

      if (invoices.length > 0) {
        const normalised = invoices.map((inv) => normaliseInvoice(companyId, inv))

        const invoiceResult = await upsertRecords(
          'invoices',
          normalised as unknown as Record<string, unknown>[],
          ['company_id', 'external_id'],
        )

        recordsWritten += invoiceResult.written
        errors.push(...invoiceResult.errors)

        // 2. Sync payments for recently updated invoices
        const paymentResult = await syncPayments(accessToken, companyId, invoices)
        recordsWritten += paymentResult.written
        errors.push(...paymentResult.errors)
      }

      recordsSkipped = recordsFetched - recordsWritten
    } catch (err) {
      errors.push({
        code: 'BEXIO_SYNC_FATAL',
        message: err instanceof Error ? err.message : String(err),
        context: {},
      })
    }

    return {
      success: errors.length === 0,
      recordsFetched,
      recordsWritten,
      recordsSkipped: Math.max(0, recordsSkipped),
      errors,
      durationMs: Date.now() - startTime,
    }
  },
}
