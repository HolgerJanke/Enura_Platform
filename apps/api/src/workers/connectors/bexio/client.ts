import { z } from 'zod'
import { ConnectorAuthError, ConnectorRateLimitError } from '../base.js'
import { BexioInvoiceSchema, BexioPaymentSchema, type BexioInvoice, type BexioPayment } from './schemas.js'

const BEXIO_API_BASE = 'https://api.bexio.com/2.0'

export interface BexioListOptions {
  offset?: number
  limit?: number
}

/**
 * Low-level HTTP request helper for the Bexio REST API.
 */
async function bexioRequest<T>(
  accessToken: string,
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const url = `${BEXIO_API_BASE}${path}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (response.status === 401 || response.status === 403) {
    throw new ConnectorAuthError(`Bexio auth error (${response.status}) for ${path}`)
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000
    throw new ConnectorRateLimitError(retryMs, 'Bexio rate limit exceeded')
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Bexio API error (${response.status}) for ${path}: ${errorText}`)
  }

  const raw: unknown = await response.json()
  return schema.parse(raw)
}

/**
 * Fetch invoices from Bexio with pagination support.
 */
export async function getInvoices(
  accessToken: string,
  opts?: BexioListOptions,
): Promise<BexioInvoice[]> {
  const offset = opts?.offset ?? 0
  const limit = opts?.limit ?? 100
  const path = `/kb_invoice?offset=${offset}&limit=${limit}&order_by=updated_at&order=DESC`

  return bexioRequest(accessToken, path, z.array(BexioInvoiceSchema))
}

/**
 * Fetch payments for a specific Bexio invoice.
 */
export async function getInvoicePayments(
  accessToken: string,
  invoiceId: number,
): Promise<BexioPayment[]> {
  const path = `/kb_invoice/${invoiceId}/payment`

  return bexioRequest(accessToken, path, z.array(BexioPaymentSchema))
}
