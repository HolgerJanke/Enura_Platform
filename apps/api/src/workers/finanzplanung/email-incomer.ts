/**
 * E-Mail Incomer Worker
 *
 * Polls a dedicated invoice inbox via IMAP, downloads attachments
 * (PDF, images), stores them in Supabase Storage, creates
 * invoices_incoming records, and triggers extraction.
 *
 * See Finanzplanung_Konzept_v1_2.pdf Section 3.1
 *
 * Configuration per company is stored in company_feature_flags
 * or a dedicated email config table (future). For now, uses
 * environment variables for the shared inbox.
 *
 * Dependencies: imapflow (must be installed: pnpm add imapflow)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { processInvoiceExtraction, type InvoiceExtractionJobData } from './invoice-extraction-worker.js'
import { processInvoiceMatching, type InvoiceMatchJobData } from './invoice-matching-worker.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailIncomerConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  mailbox: string
  companyId: string
  holdingId: string
  pollIntervalMs: number
}

export interface EmailPollResult {
  messagesProcessed: number
  invoicesCreated: number
  errors: string[]
}

interface ParsedAttachment {
  filename: string
  content: Buffer
  contentType: string
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
// Default config from env vars
// ---------------------------------------------------------------------------

export function getDefaultEmailConfig(): EmailIncomerConfig | null {
  const host = process.env.INVOICE_IMAP_HOST
  const user = process.env.INVOICE_IMAP_USER
  const pass = process.env.INVOICE_IMAP_PASS
  const companyId = process.env.INVOICE_IMAP_COMPANY_ID
  const holdingId = process.env.INVOICE_IMAP_HOLDING_ID

  if (!host || !user || !pass || !companyId || !holdingId) return null

  return {
    host,
    port: Number(process.env.INVOICE_IMAP_PORT ?? 993),
    secure: process.env.INVOICE_IMAP_SECURE !== 'false',
    auth: { user, pass },
    mailbox: process.env.INVOICE_IMAP_MAILBOX ?? 'INBOX',
    companyId,
    holdingId,
    pollIntervalMs: Number(process.env.INVOICE_POLL_INTERVAL_MS ?? 300000), // 5 min default
  }
}

// ---------------------------------------------------------------------------
// Main poll function
// ---------------------------------------------------------------------------

export async function pollInvoiceEmails(
  config: EmailIncomerConfig,
): Promise<EmailPollResult> {
  const result: EmailPollResult = {
    messagesProcessed: 0,
    invoicesCreated: 0,
    errors: [],
  }

  let ImapFlow: typeof import('imapflow').ImapFlow

  try {
    const mod = await import('imapflow')
    ImapFlow = mod.ImapFlow
  } catch {
    result.errors.push('imapflow not installed. Run: pnpm add imapflow')
    console.error('[email-incomer] imapflow package not found.')
    return result
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    logger: false,
  })

  try {
    await client.connect()
    console.log(`[email-incomer] Connected to ${config.host}`)

    const lock = await client.getMailboxLock(config.mailbox)

    try {
      // Fetch unseen messages
      const messages = client.fetch({ seen: false }, {
        envelope: true,
        source: true,
        bodyStructure: true,
      })

      for await (const msg of messages) {
        result.messagesProcessed++

        try {
          const attachments = await extractAttachments(client, msg)

          if (attachments.length === 0) {
            // No attachments — skip but mark as seen
            await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true })
            continue
          }

          // Process each attachment as a separate invoice
          for (const attachment of attachments) {
            const isInvoice = isInvoiceAttachment(attachment.contentType, attachment.filename)
            if (!isInvoice) continue

            try {
              const invoiceId = await createInvoiceFromAttachment(
                config.companyId,
                config.holdingId,
                attachment,
                msg.envelope?.from?.[0]?.address ?? null,
                msg.envelope?.messageId ?? null,
              )

              result.invoicesCreated++

              // Trigger extraction asynchronously
              const extractionJob: InvoiceExtractionJobData = {
                invoiceId,
                companyId: config.companyId,
                holdingId: config.holdingId,
                storagePath: `${config.holdingId}/${config.companyId}/${invoiceId}/${attachment.filename}`,
                mimeType: attachment.contentType,
              }

              // Run extraction then matching
              const extractResult = await processInvoiceExtraction(extractionJob)
              if (extractResult.success) {
                const matchJob: InvoiceMatchJobData = {
                  invoiceId,
                  companyId: config.companyId,
                  holdingId: config.holdingId,
                }
                await processInvoiceMatching(matchJob)
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              result.errors.push(`Attachment ${attachment.filename}: ${message}`)
            }
          }

          // Mark as seen after processing
          await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          result.errors.push(`Message ${msg.uid}: ${message}`)
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    result.errors.push(`IMAP connection: ${message}`)
    console.error('[email-incomer] Connection error:', message)
  }

  console.log(
    `[email-incomer] Poll complete: ${result.messagesProcessed} messages, ` +
      `${result.invoicesCreated} invoices, ${result.errors.length} errors`,
  )

  return result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInvoiceAttachment(contentType: string, filename: string): boolean {
  const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff']
  if (validTypes.includes(contentType)) return true

  const ext = filename.toLowerCase().split('.').pop()
  return ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(ext ?? '')
}

async function extractAttachments(
  _client: unknown,
  msg: { source?: Buffer },
): Promise<ParsedAttachment[]> {
  const attachments: ParsedAttachment[] = []

  if (!msg.source) return attachments

  // Simple MIME boundary parsing for attachments
  const source = msg.source.toString('utf-8')
  const boundaryMatch = source.match(/boundary="?([^"\s;]+)"?/)
  if (!boundaryMatch) return attachments

  const boundary = boundaryMatch[1]!
  const parts = source.split(`--${boundary}`)

  for (const part of parts) {
    const contentDisposition = part.match(/Content-Disposition:\s*attachment;\s*filename="?([^"\r\n]+)"?/i)
    if (!contentDisposition) continue

    const filename = contentDisposition[1]!.trim()
    const contentTypeMatch = part.match(/Content-Type:\s*([^\s;]+)/i)
    const contentType = contentTypeMatch?.[1] ?? 'application/octet-stream'
    const encodingMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i)
    const encoding = encodingMatch?.[1]?.toLowerCase() ?? '7bit'

    // Find the body (after double CRLF)
    const bodyStart = part.indexOf('\r\n\r\n')
    if (bodyStart === -1) continue

    const bodyStr = part.slice(bodyStart + 4).trim()
    let content: Buffer

    if (encoding === 'base64') {
      content = Buffer.from(bodyStr.replace(/\s/g, ''), 'base64')
    } else {
      content = Buffer.from(bodyStr, 'utf-8')
    }

    attachments.push({ filename, content, contentType })
  }

  return attachments
}

async function createInvoiceFromAttachment(
  companyId: string,
  holdingId: string,
  attachment: ParsedAttachment,
  senderEmail: string | null,
  messageId: string | null,
): Promise<string> {
  const db = getServiceClient()

  // Generate storage path
  const timestamp = Date.now()
  const storagePath = `${holdingId}/${companyId}/email-${timestamp}-${attachment.filename}`

  // Upload to storage
  const { error: uploadError } = await db.storage
    .from('invoices-incoming')
    .upload(storagePath, attachment.content, {
      contentType: attachment.contentType,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  // Create invoice record
  const { data: invoice, error: insertError } = await db
    .from('invoices_incoming')
    .insert({
      holding_id: holdingId,
      company_id: companyId,
      raw_storage_path: storagePath,
      raw_filename: attachment.filename,
      raw_mime_type: attachment.contentType,
      incomer_type: 'email',
      incomer_ref: messageId,
      incomer_received_at: new Date().toISOString(),
      sender_email: senderEmail,
      status: 'received',
      extraction_status: 'pending',
      currency: 'CHF',
    })
    .select('id')
    .single()

  if (insertError || !invoice) {
    throw new Error(`Invoice insert failed: ${insertError?.message ?? 'No data'}`)
  }

  return (invoice as { id: string }).id
}

// ---------------------------------------------------------------------------
// Scheduler entry point
// ---------------------------------------------------------------------------

let pollingInterval: ReturnType<typeof setInterval> | null = null

export function startEmailPolling(): void {
  const config = getDefaultEmailConfig()
  if (!config) {
    console.log('[email-incomer] No IMAP config found. Email polling disabled.')
    return
  }

  console.log(`[email-incomer] Starting polling every ${config.pollIntervalMs / 1000}s`)

  // Run immediately, then on interval
  void pollInvoiceEmails(config)

  pollingInterval = setInterval(() => {
    void pollInvoiceEmails(config)
  }, config.pollIntervalMs)
}

export function stopEmailPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
    console.log('[email-incomer] Polling stopped.')
  }
}
