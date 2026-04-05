import { z } from 'zod'

const RecipientSchema = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  registration_number: z.string().nullable(),
})

const SenderSchema = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  registration_number: z.string().nullable(),
  vat_number: z.string().nullable(),
  email: z.string().nullable(),
  contact_name: z.string().nullable(),
  contact_phone: z.string().nullable(),
})

const HeaderSchema = z.object({
  invoice_number: z.string().nullable(),
  invoice_date: z.string().nullable(),
  project_reference: z.string().nullable(),
  customer_name: z.string().nullable(),
  customer_address: z.string().nullable(),
})

const LineItemSchema = z.object({
  position: z.number().int(),
  article_number: z.string().nullable(),
  description: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unit_price: z.number().nullable(),
  line_total: z.number().nullable(),
  vat_rate: z.number().nullable(),
})

const TotalsSchema = z.object({
  net_amount: z.number().nullable(),
  vat_rate: z.number().nullable(),
  vat_amount: z.number().nullable(),
  gross_amount: z.number().nullable(),
  currency: z.string().default('CHF'),
})

const PaymentSchema = z.object({
  payment_terms_text: z.string().nullable(),
  payment_terms_days: z.number().int().nullable(),
  due_date: z.string().nullable(),
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  bank_name: z.string().nullable(),
  reference: z.string().nullable(),
})

export const InvoiceExtractionResponseSchema = z.object({
  recipient: RecipientSchema,
  sender: SenderSchema,
  header: HeaderSchema,
  line_items: z.array(LineItemSchema),
  totals: TotalsSchema,
  payment: PaymentSchema,
})

export type InvoiceExtractionResponse = z.infer<typeof InvoiceExtractionResponseSchema>
