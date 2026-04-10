/**
 * Invoice Extraction Worker
 *
 * Processes an uploaded invoice (PDF/image) stored in Supabase Storage:
 * 1. Downloads the file from storage
 * 2. Sends to Claude API for structured data extraction
 * 3. Validates response with Zod
 * 4. Updates invoices_incoming with extracted fields
 * 5. Creates/matches supplier record
 * 6. Creates invoice_line_items
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { callClaude } from '../../lib/ai/anthropic.js'
import { loadPrompt } from '../../ai/prompts/loader.js'
import { parseJsonResponse } from '../../ai/parse-json-response.js'
import {
  InvoiceExtractionResponseSchema,
  type InvoiceExtractionResponse,
} from '../../ai/schemas/invoice-extraction-response.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceExtractionJobData {
  invoiceId: string
  companyId: string
  holdingId: string
  storagePath: string
  mimeType: string
}

export interface ExtractionResult {
  success: boolean
  invoiceId: string
  extractedFields: number
  lineItemCount: number
  supplierId: string | null
  error?: string
}

// ---------------------------------------------------------------------------
// Service client
// ---------------------------------------------------------------------------

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processInvoiceExtraction(
  job: InvoiceExtractionJobData,
): Promise<ExtractionResult> {
  const { invoiceId, companyId, holdingId, storagePath, mimeType } = job
  const db = getServiceClient()

  // Mark as processing
  await db
    .from('invoices_incoming')
    .update({ extraction_status: 'processing' })
    .eq('id', invoiceId)

  try {
    // 1. Download file from storage
    const { data: fileData, error: downloadError } = await db.storage
      .from('invoices-incoming')
      .download(storagePath)

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message ?? 'No data'}`)
    }

    // 2. Convert to base64 for Claude vision
    const buffer = Buffer.from(await fileData.arrayBuffer())
    const base64 = buffer.toString('base64')

    // 3. Load prompts
    const systemPrompt = await loadPrompt('invoice-extraction-system')
    const userPromptTemplate = await loadPrompt('invoice-extraction')

    // 4. Call Claude with vision (document as image)
    const mediaType = mimeType === 'application/pdf' ? 'application/pdf' : mimeType
    const rawResponse = await callClaudeWithVision(
      systemPrompt,
      userPromptTemplate,
      base64,
      mediaType,
    )

    // 5. Parse and validate
    const extracted = parseJsonResponse(rawResponse, InvoiceExtractionResponseSchema)

    // 6. Update invoice with extracted data
    const updatePayload: Record<string, unknown> = {
      extracted_data: extracted,
      extraction_status: 'completed',
      extraction_model: 'claude-sonnet-4-6',
      extraction_at: new Date().toISOString(),
      // Header fields
      invoice_number: extracted.header.invoice_number,
      invoice_date: extracted.header.invoice_date,
      // Recipient
      recipient_name: extracted.recipient.name,
      recipient_address: extracted.recipient.address,
      recipient_reg_number: extracted.recipient.registration_number,
      // Sender
      sender_name: extracted.sender.name,
      sender_address: extracted.sender.address,
      sender_reg_number: extracted.sender.registration_number,
      sender_vat_number: extracted.sender.vat_number,
      sender_email: extracted.sender.email,
      sender_contact_name: extracted.sender.contact_name,
      sender_contact_phone: extracted.sender.contact_phone,
      // Totals
      net_amount: extracted.totals.net_amount,
      vat_rate: extracted.totals.vat_rate,
      vat_amount: extracted.totals.vat_amount,
      gross_amount: extracted.totals.gross_amount,
      currency: extracted.totals.currency,
      // Payment
      payment_terms_days: extracted.payment.payment_terms_days,
      payment_terms_text: extracted.payment.payment_terms_text,
      due_date: extracted.payment.due_date,
      // Matching raw fields
      project_ref_raw: extracted.header.project_reference,
      customer_name_raw: extracted.header.customer_name,
      customer_address_raw: extracted.header.customer_address,
      // Status transition
      status: 'extraction_done',
    }

    await db.from('invoices_incoming').update(updatePayload).eq('id', invoiceId)

    // 7. Create line items
    if (extracted.line_items.length > 0) {
      const lineItems = extracted.line_items.map((item) => ({
        invoice_id: invoiceId,
        holding_id: holdingId,
        company_id: companyId,
        position: item.position,
        article_number: item.article_number,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        line_total: item.line_total,
        vat_rate: item.vat_rate,
      }))

      await db.from('invoice_line_items').insert(lineItems)
    }

    // 8. Match or create supplier
    const supplierId = await matchOrCreateSupplier(
      db,
      holdingId,
      companyId,
      invoiceId,
      extracted,
    )

    if (supplierId) {
      await db.from('invoices_incoming').update({ supplier_id: supplierId }).eq('id', invoiceId)
    }

    console.log(
      `[invoice-extraction] Completed for invoice ${invoiceId}: ` +
        `${extracted.line_items.length} line items, supplier=${supplierId ?? 'none'}`,
    )

    return {
      success: true,
      invoiceId,
      extractedFields: Object.keys(updatePayload).length,
      lineItemCount: extracted.line_items.length,
      supplierId,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[invoice-extraction] Failed for invoice ${invoiceId}:`, message)

    await db
      .from('invoices_incoming')
      .update({
        extraction_status: 'failed',
        extraction_error: message.slice(0, 500),
      })
      .eq('id', invoiceId)

    return {
      success: false,
      invoiceId,
      extractedFields: 0,
      lineItemCount: 0,
      supplierId: null,
      error: message,
    }
  }
}

// ---------------------------------------------------------------------------
// Claude Vision call (for PDF/image documents)
// ---------------------------------------------------------------------------

async function callClaudeWithVision(
  systemPrompt: string,
  userPrompt: string,
  base64Data: string,
  mediaType: string,
): Promise<string> {
  const { getAnthropicClient } = await import('../../lib/ai/anthropic.js')
  const anthropic = getAnthropicClient()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: userPrompt,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('[invoice-extraction] Claude response contained no text block.')
  }

  return textBlock.text
}

// ---------------------------------------------------------------------------
// Supplier matching
// ---------------------------------------------------------------------------

async function matchOrCreateSupplier(
  db: SupabaseClient,
  holdingId: string,
  companyId: string,
  invoiceId: string,
  extracted: InvoiceExtractionResponse,
): Promise<string | null> {
  const senderName = extracted.sender.name
  if (!senderName) return null

  const normalizedName = senderName.toLowerCase().trim()

  // Try to match by VAT number first (most reliable)
  if (extracted.sender.vat_number) {
    const { data: vatMatch } = await db
      .from('suppliers')
      .select('id')
      .eq('holding_id', holdingId)
      .eq('vat_number', extracted.sender.vat_number)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (vatMatch) return (vatMatch as { id: string }).id
  }

  // Try to match by IBAN
  if (extracted.payment.iban) {
    const { data: ibanMatch } = await db
      .from('suppliers')
      .select('id')
      .eq('holding_id', holdingId)
      .eq('iban', extracted.payment.iban)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (ibanMatch) return (ibanMatch as { id: string }).id
  }

  // Try to match by normalized name
  const { data: nameMatch } = await db
    .from('suppliers')
    .select('id')
    .eq('holding_id', holdingId)
    .eq('name_normalized', normalizedName)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (nameMatch) return (nameMatch as { id: string }).id

  // No match — create new supplier
  const { data: newSupplier } = await db
    .from('suppliers')
    .insert({
      holding_id: holdingId,
      company_id: companyId,
      name: senderName,
      address_line_1: extracted.sender.address,
      vat_number: extracted.sender.vat_number,
      contact_name: extracted.sender.contact_name,
      contact_phone: extracted.sender.contact_phone,
      contact_email: extracted.sender.email,
      iban: extracted.payment.iban,
      bic: extracted.payment.bic,
      bank_name: extracted.payment.bank_name,
      preferred_payment_days: extracted.payment.payment_terms_days ?? 30,
      created_from_invoice: invoiceId,
    })
    .select('id')
    .single()

  return newSupplier ? (newSupplier as { id: string }).id : null
}
