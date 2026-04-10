import type { InvoiceInsert, PaymentInsert } from '@enura/types'
import { BEXIO_STATUS_MAP, type BexioInvoice, type BexioPayment } from './schemas.js'

/**
 * Map a Bexio invoice status ID to the internal InvoiceStatus enum.
 * Falls back to 'draft' for unmapped statuses.
 */
function mapInvoiceStatus(
  statusId: number,
): 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'partially_paid' {
  const mapped = BEXIO_STATUS_MAP[statusId]
  switch (mapped) {
    case 'draft':
    case 'sent':
    case 'paid':
    case 'overdue':
    case 'partially_paid':
      return mapped
    default:
      return 'draft'
  }
}

/**
 * Transform a raw Bexio invoice into the shape expected by the invoices table.
 */
export function normaliseInvoice(
  companyId: string,
  invoice: BexioInvoice,
): InvoiceInsert {
  return {
    company_id: companyId,
    external_id: String(invoice.id),
    invoice_number: invoice.document_nr ?? `BEXIO-${invoice.id}`,
    customer_name: invoice.title ?? `Contact ${invoice.contact_id ?? 'unknown'}`,
    amount_chf: invoice.total_net,
    tax_chf: invoice.total_taxes,
    total_chf: invoice.total_gross,
    status: mapInvoiceStatus(invoice.kb_item_status_id),
    issued_at: invoice.is_valid_from ?? invoice.updated_at,
    // Bexio does not expose due_at directly in the list endpoint —
    // default to 30 days after issue date
    due_at: computeDueDate(invoice.is_valid_from ?? invoice.updated_at),
  }
}

/**
 * Transform a raw Bexio payment into the shape expected by the payments table.
 */
export function normalisePayment(
  companyId: string,
  invoiceId: string,
  payment: BexioPayment,
): PaymentInsert {
  return {
    company_id: companyId,
    invoice_id: invoiceId,
    amount_chf: payment.value,
    received_at: payment.date,
    reference: `bexio-payment-${payment.id}`,
    notes: payment.title,
  }
}

/**
 * Compute a due date 30 days after the issue date.
 */
function computeDueDate(issuedAt: string): string {
  const date = new Date(issuedAt)
  date.setDate(date.getDate() + 30)
  return date.toISOString()
}
