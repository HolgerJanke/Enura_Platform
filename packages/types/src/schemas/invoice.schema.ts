import { z } from 'zod'

export const CreateInvoiceSchema = z.object({
  offerId: z.string().uuid().optional(),
  invoiceNumber: z.string().min(1).max(50),
  customerName: z.string().min(1).max(200),
  amountChf: z.number().min(0),
  taxChf: z.number().min(0).default(0),
  totalChf: z.number().min(0),
  issuedAt: z.string(),
  dueAt: z.string(),
})

export const UpdateInvoiceSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid']).optional(),
  paidAt: z.string().nullable().optional(),
})

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>
