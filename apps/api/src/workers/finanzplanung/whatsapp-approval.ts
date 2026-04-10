/**
 * WhatsApp Invoice Approval Integration
 *
 * Sends approval requests via WhatsApp and processes responses.
 * Uses the existing WhatsApp Cloud API client from Prompt 06.
 *
 * See Finanzplanung_Konzept_v1_2.pdf Section 4.4
 *
 * Flow:
 * 1. sendApprovalRequest() — sends summary to approver via WhatsApp
 * 2. processWhatsAppResponse() — called by webhook handler when reply arrives
 *    - "Genehmigt" or similar → mark as approved
 *    - Any other text → treat as rejection/comment
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { WhatsAppCloudApiClient, type WhatsAppClientConfig } from '../connectors/whatsapp/client.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApprovalRequestData {
  invoiceId: string
  companyId: string
  holdingId: string
  approverId: string
  requestedBy: string
}

export interface WhatsAppResponseData {
  waMessageId: string
  fromNumber: string
  responseText: string
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
// Approval keywords (NLP-like recognition)
// ---------------------------------------------------------------------------

const APPROVAL_PATTERNS = [
  /^genehmigt$/i,
  /^ja$/i,
  /^ok$/i,
  /^freigegeben$/i,
  /^approved$/i,
  /^yes$/i,
  /^genehm/i,
  /^👍$/,
  /^✅$/,
]

function isApprovalResponse(text: string): boolean {
  const trimmed = text.trim()
  return APPROVAL_PATTERNS.some((pattern) => pattern.test(trimmed))
}

// ---------------------------------------------------------------------------
// Send approval request
// ---------------------------------------------------------------------------

export async function sendApprovalRequest(
  data: ApprovalRequestData,
): Promise<{ success: boolean; approvalId?: string; error?: string }> {
  const db = getServiceClient()

  // Fetch invoice details
  const { data: invoice } = await db
    .from('invoices_incoming')
    .select('invoice_number, sender_name, gross_amount, currency, due_date, raw_storage_path')
    .eq('id', data.invoiceId)
    .single()

  if (!invoice) {
    return { success: false, error: 'Rechnung nicht gefunden.' }
  }

  const inv = invoice as Record<string, unknown>

  // Fetch approver's WhatsApp number from profile
  const { data: profile } = await db
    .from('profiles')
    .select('phone, display_name, first_name, last_name')
    .eq('id', data.approverId)
    .single()

  if (!profile) {
    return { success: false, error: 'Genehmiger nicht gefunden.' }
  }

  const approverPhone = (profile as Record<string, unknown>)['phone'] as string | null
  if (!approverPhone) {
    return { success: false, error: 'Keine Telefonnummer für den Genehmiger hinterlegt.' }
  }

  const approverName = [
    (profile as Record<string, unknown>)['first_name'],
    (profile as Record<string, unknown>)['last_name'],
  ].filter(Boolean).join(' ') || (profile as Record<string, unknown>)['display_name'] as string || 'Genehmiger'

  // Create approval record
  const { data: approval, error: insertError } = await db
    .from('invoice_approvals')
    .insert({
      invoice_id: data.invoiceId,
      holding_id: data.holdingId,
      company_id: data.companyId,
      approver_id: data.approverId,
      requested_by: data.requestedBy,
      whatsapp_number: approverPhone,
      channel: 'whatsapp',
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !approval) {
    return { success: false, error: insertError?.message ?? 'Fehler beim Erstellen der Genehmigungsanfrage.' }
  }

  const approvalId = (approval as { id: string }).id

  // Compose WhatsApp message
  const amount = Number(inv['gross_amount'] ?? 0)
  const currency = inv['currency'] as string
  const dueDate = inv['due_date'] as string | null

  const message = [
    `📋 *Rechnungsgenehmigung*`,
    ``,
    `Rechnungssteller: ${inv['sender_name'] ?? 'Unbekannt'}`,
    `Rechnungsnr.: ${inv['invoice_number'] ?? '—'}`,
    `Betrag: ${currency} ${amount.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`,
    dueDate ? `Fälligkeit: ${new Date(dueDate).toLocaleDateString('de-CH')}` : '',
    ``,
    `Antworten Sie mit "Genehmigt" oder einem Kommentar.`,
    `Ref: ${data.invoiceId.slice(0, 8)}`,
  ].filter(Boolean).join('\n')

  // Send via WhatsApp
  try {
    const waClient = getWhatsAppClient(db, data.companyId)
    if (!waClient) {
      // Update approval to platform-only
      await db.from('invoice_approvals').update({ channel: 'platform' }).eq('id', approvalId)
      return { success: true, approvalId, error: 'WhatsApp nicht konfiguriert. Genehmigung nur ueber Plattform.' }
    }

    const result = await waClient.sendTextMessage({
      to: approverPhone,
      body: message,
    })

    // Store WhatsApp message ID for response matching
    await db
      .from('invoice_approvals')
      .update({ whatsapp_message_id: result.messageId })
      .eq('id', approvalId)

    console.log(
      `[whatsapp-approval] Sent approval request to ${approverName} for invoice ${data.invoiceId.slice(0, 8)}`,
    )

    return { success: true, approvalId }
  } catch (err) {
    const message2 = err instanceof Error ? err.message : String(err)
    console.error(`[whatsapp-approval] Send failed:`, message2)
    // Don't fail the whole flow — approval can still happen via platform
    await db.from('invoice_approvals').update({ channel: 'platform' }).eq('id', approvalId)
    return { success: true, approvalId, error: `WhatsApp-Versand fehlgeschlagen: ${message2}` }
  }
}

// ---------------------------------------------------------------------------
// Process WhatsApp response (called from webhook handler)
// ---------------------------------------------------------------------------

export async function processWhatsAppResponse(
  data: WhatsAppResponseData,
): Promise<{ success: boolean; action: 'approved' | 'rejected' | 'not_found'; invoiceId?: string }> {
  const db = getServiceClient()

  // Find pending approval by WhatsApp number
  const { data: approval } = await db
    .from('invoice_approvals')
    .select('id, invoice_id, holding_id, company_id, approver_id')
    .eq('whatsapp_number', data.fromNumber)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!approval) {
    // Also try matching by extracting invoice ref from response
    const refMatch = data.responseText.match(/([0-9a-f]{8})/i)
    if (refMatch) {
      const { data: refApproval } = await db
        .from('invoice_approvals')
        .select('id, invoice_id, holding_id, company_id, approver_id')
        .eq('status', 'pending')
        .ilike('invoice_id', `${refMatch[1]}%`)
        .limit(1)
        .maybeSingle()

      if (!refApproval) {
        return { success: false, action: 'not_found' }
      }

      return processApprovalDecision(db, refApproval as Record<string, string>, data)
    }

    return { success: false, action: 'not_found' }
  }

  return processApprovalDecision(db, approval as Record<string, string>, data)
}

async function processApprovalDecision(
  db: SupabaseClient,
  approval: Record<string, string>,
  data: WhatsAppResponseData,
): Promise<{ success: boolean; action: 'approved' | 'rejected'; invoiceId: string }> {
  const isApproved = isApprovalResponse(data.responseText)
  const invoiceId = approval['invoice_id']!

  // Update approval record
  await db
    .from('invoice_approvals')
    .update({
      status: isApproved ? 'approved' : 'rejected',
      response_text: data.responseText,
      responded_at: new Date().toISOString(),
      channel: 'whatsapp',
    })
    .eq('id', approval['id'])

  if (isApproved) {
    // Update invoice status to approved
    await db
      .from('invoices_incoming')
      .update({ status: 'approved' })
      .eq('id', invoiceId)

    // Log validation
    await db.from('invoice_validations').insert({
      invoice_id: invoiceId,
      holding_id: approval['holding_id'],
      company_id: approval['company_id'],
      validation_step: 3,
      action: 'approve',
      actor_id: approval['approver_id'],
      comment: `WhatsApp-Genehmigung: "${data.responseText}"`,
      approval_channel: 'whatsapp',
    })

    console.log(`[whatsapp-approval] Invoice ${invoiceId.slice(0, 8)} APPROVED via WhatsApp`)
  } else {
    // Update invoice status — return to validator
    await db
      .from('invoices_incoming')
      .update({ status: 'returned_internal' })
      .eq('id', invoiceId)

    await db.from('invoice_validations').insert({
      invoice_id: invoiceId,
      holding_id: approval['holding_id'],
      company_id: approval['company_id'],
      validation_step: 3,
      action: 'reject',
      actor_id: approval['approver_id'],
      comment: `WhatsApp-Kommentar: "${data.responseText}"`,
      approval_channel: 'whatsapp',
    })

    console.log(`[whatsapp-approval] Invoice ${invoiceId.slice(0, 8)} REJECTED via WhatsApp: "${data.responseText}"`)
  }

  return { success: true, action: isApproved ? 'approved' : 'rejected', invoiceId }
}

// ---------------------------------------------------------------------------
// WhatsApp client helper
// ---------------------------------------------------------------------------

function getWhatsAppClient(
  _db: SupabaseClient,
  _companyId: string,
): WhatsAppCloudApiClient | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId) return null

  return new WhatsAppCloudApiClient({
    accessToken,
    phoneNumberId,
  })
}
