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
// Bexio Bill (Kreditoren) Status Map
// ---------------------------------------------------------------------------

export const BEXIO_BILL_STATUS_MAP: Record<number, string> = {
  7: 'draft',
  8: 'pending', // Offen
  9: 'paid',
  16: 'partially_paid',
  19: 'overdue',
}

// ---------------------------------------------------------------------------
// Bexio Contact Schema
// ---------------------------------------------------------------------------

export const BexioContactSchema = z
  .object({
    id: z.number(),
    contact_type_id: z.number(), // 1 = company, 2 = person
    name_1: z.string().nullable(), // Company name or last name
    name_2: z.string().nullable(), // First name (for persons)
    address: z.string().nullable(),
    postcode: z.string().nullable(),
    city: z.string().nullable(),
    country_id: z.number().nullable(),
    mail: z.string().nullable(),
    phone_fixed: z.string().nullable(),
    updated_at: z.string(),
  })
  .passthrough()

export type BexioContact = z.infer<typeof BexioContactSchema>

// ---------------------------------------------------------------------------
// Bexio Bill (Kreditorenrechnung) Schema
// ---------------------------------------------------------------------------

export const BexioBillSchema = z
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
    is_valid_to: z.string().nullable(), // due date
    updated_at: z.string(),
  })
  .passthrough()

export type BexioBill = z.infer<typeof BexioBillSchema>

// ---------------------------------------------------------------------------
// Bexio Credentials Schema (stored in connector.credentials)
// ---------------------------------------------------------------------------

export const BexioCredentialsSchema = z.object({
  access_token: z.string().min(1),
  client_id: z.string().min(1).optional(),
  client_secret: z.string().min(1).optional(),
  refresh_token: z.string().min(1).optional(),
  expires_at: z.string().optional(),
})

export type BexioCredentials = z.infer<typeof BexioCredentialsSchema>

export const BexioOAuthCredentialsSchema = z.object({
  access_token: z.string().min(1),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_at: z.string(),
})

export type BexioOAuthCredentials = z.infer<typeof BexioOAuthCredentialsSchema>
