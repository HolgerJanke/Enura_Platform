import { z } from 'zod'

// ---------------------------------------------------------------------------
// Bexio Invoice Status Map
// ---------------------------------------------------------------------------

export const BEXIO_STATUS_MAP: Record<number, string> = {
  7: 'draft',
  8: 'sent',
  9: 'paid',
  16: 'partially_paid',
  19: 'overdue',
}

// ---------------------------------------------------------------------------
// Bexio API Response Schemas
// ---------------------------------------------------------------------------

export const BexioInvoiceSchema = z
  .object({
    id: z.number(),
    document_nr: z.string().nullable(),
    title: z.string().nullable(),
    contact_id: z.number().nullable(),
    total_gross: z.string(),
    total_net: z.string(),
    total_taxes: z.string(),
    kb_item_status_id: z.number(),
    is_valid_from: z.string().nullable(),
    updated_at: z.string(),
  })
  .passthrough()

export type BexioInvoice = z.infer<typeof BexioInvoiceSchema>

export const BexioPaymentSchema = z
  .object({
    id: z.number(),
    value: z.string(),
    date: z.string(),
    title: z.string().nullable(),
  })
  .passthrough()

export type BexioPayment = z.infer<typeof BexioPaymentSchema>

// ---------------------------------------------------------------------------
// Bexio Credentials Schema (stored in connector.credentials)
//
// Two supported auth modes:
//
//   1. Personal Access Token (PAT) — only `access_token` is required.
//      The token is a long-lived JWT issued by Bexio (auth.bexio.com →
//      API Tokens). It does not refresh; when it expires, the user
//      generates a new one and updates the connector.
//
//   2. OAuth 2.0 — full set of `client_id`, `client_secret`,