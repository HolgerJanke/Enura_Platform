/**
 * Payment File Export
 *
 * Generates payment files in configurable formats:
 * - pain.001.001.09 (SEPA Credit Transfer)
 * - pain.001 CH (Swiss Payment Standards / SPS by SIX)
 * - MT101 (SWIFT legacy)
 * - CSV (configurable columns)
 *
 * See Finanzplanung_Konzept_v1_2.pdf Section 7
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentFileExportJobData {
  runId: string
  companyId: string
  holdingId: string
  format: 'pain001_sepa' | 'pain001_ch' | 'mt101' | 'csv_custom'
}

export interface ExportResult {
  success: boolean
  runId: string
  format: string
  storagePath: string | null
  error?: string
}

interface PaymentItem {
  creditor_name: string
  creditor_iban: string
  creditor_bic: string | null
  amount: number
  currency: string
  payment_reference: string | null
  remittance_info: string | null
}

interface BankingConfig {
  iban: string | null
  bic: string | null
  bank_name: string | null
  account_holder_name: string | null
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
// Main export function
// ---------------------------------------------------------------------------

export async function exportPaymentFile(
  job: PaymentFileExportJobData,
): Promise<ExportResult> {
  const { runId, companyId, holdingId, format } = job
  const db = getServiceClient()

  try {
    // Fetch payment run items
    const { data: items } = await db
      .from('payment_run_items')
      .select('creditor_name, creditor_iban, creditor_bic, amount, currency, payment_reference, remittance_info')
      .eq('run_id', runId)
      .order('sort_order')

    if (!items || items.length === 0) {
      return { success: false, runId, format, storagePath: null, error: 'Keine Positionen im Zahlungslauf.' }
    }

    const paymentItems = items as unknown as PaymentItem[]

    // Fetch company banking config
    const { data: bankConfig } = await db
      .from('company_banking_config')
      .select('iban, bic, bank_name, account_holder_name')
      .eq('company_id', companyId)
      .single()

    const config = (bankConfig ?? { iban: null, bic: null, bank_name: null, account_holder_name: null }) as BankingConfig

    // Generate file content
    let content: string
    let contentType: string
    let fileExtension: string

    switch (format) {
      case 'pain001_ch':
        content = generatePain001CH(paymentItems, config, runId)
        contentType = 'application/xml'
        fileExtension = 'xml'
        break
      case 'pain001_sepa':
        content = generatePain001SEPA(paymentItems, config, runId)
        contentType = 'application/xml'
        fileExtension = 'xml'
        break
      case 'mt101':
        content = generateMT101(paymentItems, config, runId)
        contentType = 'text/plain'
        fileExtension = 'txt'
        break
      case 'csv_custom':
        content = generateCSV(paymentItems)
        contentType = 'text/csv'
        fileExtension = 'csv'
        break
      default:
        return { success: false, runId, format, storagePath: null, error: `Unbekanntes Format: ${format}` }
    }

    // Upload to storage
    const timestamp = Date.now()
    const storagePath = `${holdingId}/${companyId}/zahlungslauf-${runId.slice(0, 8)}-${timestamp}.${fileExtension}`

    const { error: uploadError } = await db.storage
      .from('payment-files')
      .upload(storagePath, new Blob([content], { type: contentType }), {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      return { success: false, runId, format, storagePath: null, error: `Upload fehlgeschlagen: ${uploadError.message}` }
    }

    // Update payment run with file path
    await db
      .from('payment_runs')
      .update({
        status: 'exported',
        payment_format: format,
        file_storage_path: storagePath,
        exported_at: new Date().toISOString(),
      })
      .eq('id', runId)

    console.log(`[payment-export] Exported run ${runId} as ${format} → ${storagePath}`)

    return { success: true, runId, format, storagePath }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[payment-export] Failed for run ${runId}:`, message)
    return { success: false, runId, format, storagePath: null, error: message }
  }
}

// ---------------------------------------------------------------------------
// pain.001 Swiss Payment Standards (SPS by SIX)
// ---------------------------------------------------------------------------

function generatePain001CH(
  items: PaymentItem[],
  config: BankingConfig,
  runId: string,
): string {
  const msgId = `ENURA-${runId.slice(0, 8)}-${Date.now()}`
  const creationDate = new Date().toISOString()
  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0)

  const transactions = items.map((item, idx) => `
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>INSTR-${idx + 1}</InstrId>
        <EndToEndId>${item.payment_reference ?? `E2E-${idx + 1}`}</EndToEndId>
      </PmtId>
      <Amt>
        <InstdAmt Ccy="${item.currency}">${item.amount.toFixed(2)}</InstdAmt>
      </Amt>
      ${item.creditor_bic ? `<CdtrAgt><FinInstnId><BIC>${item.creditor_bic}</BIC></FinInstnId></CdtrAgt>` : ''}
      <Cdtr>
        <Nm>${escapeXml(item.creditor_name)}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id><IBAN>${item.creditor_iban.replace(/\s/g, '')}</IBAN></Id>
      </CdtrAcct>
      ${item.remittance_info ? `<RmtInf><Ustrd>${escapeXml(item.remittance_info)}</Ustrd></RmtInf>` : ''}
    </CdtTrfTxInf>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creationDate}</CreDtTm>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(config.account_holder_name ?? 'Enura Platform')}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${runId.slice(0, 8)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <ReqdExctnDt>
        <Dt>${new Date().toISOString().split('T')[0]}</Dt>
      </ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(config.account_holder_name ?? '')}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id><IBAN>${(config.iban ?? '').replace(/\s/g, '')}</IBAN></Id>
      </DbtrAcct>
      ${config.bic ? `<DbtrAgt><FinInstnId><BIC>${config.bic}</BIC></FinInstnId></DbtrAgt>` : ''}
${transactions}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`
}

// ---------------------------------------------------------------------------
// pain.001 SEPA (EU standard)
// ---------------------------------------------------------------------------

function generatePain001SEPA(
  items: PaymentItem[],
  config: BankingConfig,
  runId: string,
): string {
  // SEPA uses pain.001.001.03 namespace but structure is nearly identical
  return generatePain001CH(items, config, runId)
    .replace('pain.001.001.09', 'pain.001.001.03')
}

// ---------------------------------------------------------------------------
// MT101 (SWIFT legacy)
// ---------------------------------------------------------------------------

function generateMT101(
  items: PaymentItem[],
  config: BankingConfig,
  runId: string,
): string {
  const lines: string[] = [
    `{1:F01${config.bic ?? 'XXXXXXXXX'}0000000000}`,
    `{2:I101${config.bic ?? 'XXXXXXXXX'}N}`,
    '{4:',
    `:20:${runId.slice(0, 16)}`,
    `:28D:1/1`,
    `:50H:/${(config.iban ?? '').replace(/\s/g, '')}`,
    config.account_holder_name ?? '',
    `:30:${new Date().toISOString().split('T')[0]!.replace(/-/g, '').slice(2)}`,
  ]

  items.forEach((item, idx) => {
    lines.push(
      `:21:TXN${String(idx + 1).padStart(4, '0')}`,
      `:32B:${item.currency}${item.amount.toFixed(2).replace('.', ',')}`,
      `:59:/${item.creditor_iban.replace(/\s/g, '')}`,
      item.creditor_name,
      `:70:${item.payment_reference ?? item.remittance_info ?? '/'}`,
    )
  })

  lines.push('-}')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// CSV (configurable)
// ---------------------------------------------------------------------------

function generateCSV(items: PaymentItem[]): string {
  const header = 'Glaeubiger;IBAN;BIC;Betrag;Waehrung;Referenz;Verwendungszweck'
  const rows = items.map((item) =>
    [
      `"${item.creditor_name}"`,
      item.creditor_iban,
      item.creditor_bic ?? '',
      item.amount.toFixed(2),
      item.currency,
      item.payment_reference ?? '',
      item.remittance_info ?? '',
    ].join(';'),
  )

  return [header, ...rows].join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
