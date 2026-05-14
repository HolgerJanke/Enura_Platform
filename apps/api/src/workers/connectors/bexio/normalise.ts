import type { InvoiceInsert, PaymentInsert } from '@enura/types'
import {
  BEXIO_STATUS_MAP,
  BEXIO_BILL_STATUS_MAP,
  type BexioInvoice,
  type BexioPayment,
  type BexioContact,
  type BexioBill,
} from './schemas.js'

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
    payment_date: payment.date,
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

// ---------------------------------------------------------------------------
// Contact → suppliers
// ---------------------------------------------------------------------------

/**
 * Transform a raw Bexio contact into the shape expected by the suppliers table.
 */
export function normaliseContact(
  companyId: string,
  holdingId: string,
  contact: BexioContact,
): Record<string, unknown> {
  const name =
    contact.contact_type_id === 1
      ? (contact.name_1 ?? 'Unknown')
      : [contact.name_2, contact.name_1].filter(Boolean).join(' ') || 'Unknown'

  return {
    company_id: companyId,
    holding_id: holdingId,
    external_id: String(contact.id),
    name,
    address_line_1: contact.address,
    postal_code: contact.postcode,
    city: contact.city,
    country:
      contact.country_id === 1
        ? 'CH'
        : contact.country_id === 2
          ? 'DE'
          : contact.country_id === 3
            ? 'AT'
            : 'CH',
    contact_email: contact.mail,
    contact_phone: contact.phone_fixed,
    is_active: true,
    preferred_payment_days: 30,
  }
}

// ---------------------------------------------------------------------------
// Bill (Kreditoren) → invoices_incoming
// ---------------------------------------------------------------------------

/**
 * Map a Bexio bill status to the internal invoices_incoming status.
 */
function mapBillStatus(statusId: number): string {
  const mapped = BEXIO_BILL_STATUS_MAP[statusId]
  switch (mapped) {
    case 'paid':
      return 'paid'
    case 'overdue':
      return 'approved' // overdue bills are approved but unpaid
    case 'partially_paid':
      return 'approved'
    case 'pending':
      return 'in_validation'
    default:
      return 'received'
  }
}

/**
 * Transform a raw Bexio bill into the shape expected by the invoices_incoming table.
 */
export function normaliseBill(
  companyId: string,
  holdingId: string,
  bill: BexioBill,
  supplierMap: Map<string, string>, // external_id → supplier UUID
): Record<string, unknown> {
  const supplierId = bill.contact_id
    ? (supplierMap.get(String(bill.contact_id)) ?? null)
    : null

  return {
    company_id: companyId,
    holding_id: holdingId,
    external_id: String(bill.id),
    invoice_number: bill.document_nr ?? `BEXIO-BILL-${bill.id}`,
    invoice_date: bill.is_valid_from,
    sender_name: bill.title ?? 'Bexio Kreditor',
    supplier_id: supplierId,
    net_amount: parseFloat(bill.total_net),
    vat_amount: parseFloat(bill.total_taxes),
    gross_amount: parseFloat(bill.total_gross),
    currency: 'CHF',
    due_date: bill.is_valid_to,
    status: mapBillStatus(bill.kb_item_status_id),
    extraction_status: 'completed',
    incomer_type: 'webhook',
    raw_storage_path: `bexio/bills/${bill.id}`,
    raw_filename: `${bill.document_nr ?? bill.id}.pdf`,
  }
}
