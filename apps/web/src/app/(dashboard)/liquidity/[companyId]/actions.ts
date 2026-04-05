'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ActionResult {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ManualEntrySchema = z.object({
  eventInstanceId: z.string().uuid(),
  companyId: z.string().uuid(),
  actualDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actualAmount: z.number().positive(),
  actualCurrency: z.string().min(2).max(5),
  fxRate: z.number().positive().nullable(),
  notes: z.string().max(2000).nullable(),
})

export type ManualEntryInput = z.infer<typeof ManualEntrySchema>

const UploadBankFileSchema = z.object({
  companyId: z.string().uuid(),
  filename: z.string().min(1),
  fileFormat: z.enum(['camt053', 'mt940', 'csv']),
  storagePath: z.string().min(1),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  transactionCount: z.number().int().min(0),
})

export type UploadBankFileInput = z.infer<typeof UploadBankFileSchema>

// ---------------------------------------------------------------------------
// saveManualEntry — Updates a liquidity_event_instance with actual values
// ---------------------------------------------------------------------------

export async function saveManualEntry(input: ManualEntryInput): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Nicht authentifiziert.' }
  }

  // Permission check
  const hasFinancePerm =
    session.isHoldingAdmin || session.permissions.includes('module:finance:read')
  if (!hasFinancePerm) {
    return { success: false, error: 'Keine Berechtigung.' }
  }

  // Validate input
  const parsed = ManualEntrySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungueltige Eingabedaten.' }
  }

  const { eventInstanceId, companyId, actualDate, actualAmount, actualCurrency, fxRate, notes } =
    parsed.data

  // Verify company access
  if (!session.isHoldingAdmin && session.companyId !== companyId) {
    return { success: false, error: 'Kein Zugriff auf dieses Unternehmen.' }
  }

  const supabase = createSupabaseServerClient()

  // Fetch the event to compute deviations
  const { data: eventRaw, error: fetchErr } = await supabase
    .from('liquidity_event_instances')
    .select('budget_amount, budget_date, plan_currency')
    .eq('id', eventInstanceId)
    .eq('company_id', companyId)
    .single()

  if (fetchErr || !eventRaw) {
    return { success: false, error: 'Liquiditaetsereignis nicht gefunden.' }
  }

  const event = eventRaw as Record<string, unknown>
  const planAmount = Number(event['budget_amount'] ?? 0)
  const planDate = event['budget_date'] as string | null

  // Compute deviations
  const amountDeviation = actualAmount - planAmount
  let dateDeviationDays: number | null = null
  if (planDate) {
    const planMs = new Date(planDate).getTime()
    const actualMs = new Date(actualDate).getTime()
    dateDeviationDays = Math.floor((actualMs - planMs) / (1000 * 60 * 60 * 24))
  }

  // Build update payload
  const updatePayload: Record<string, unknown> = {
    actual_date: actualDate,
    actual_amount: String(actualAmount),
    actual_currency: actualCurrency,
    actual_source: 'manual',
    matched_at: new Date().toISOString(),
    matched_by: session.profile.id,
    amount_deviation: String(amountDeviation),
    date_deviation_days: dateDeviationDays,
    notes: notes ?? null,
  }

  if (fxRate !== null) {
    updatePayload['fx_rate'] = String(fxRate)
    updatePayload['fx_rate_date'] = actualDate
  }

  const { error: updateErr } = await supabase
    .from('liquidity_event_instances')
    .update(updatePayload)
    .eq('id', eventInstanceId)
    .eq('company_id', companyId)

  if (updateErr) {
    return { success: false, error: `Fehler beim Speichern: ${updateErr.message}` }
  }

  // Audit log
  await supabase.from('audit_log').insert({
    company_id: companyId,
    actor_id: session.profile.id,
    action: 'liquidity.manual_entry',
    table_name: 'liquidity_event_instances',
    record_id: eventInstanceId,
    new_values: {
      actual_date: actualDate,
      actual_amount: actualAmount,
      actual_currency: actualCurrency,
      source: 'manual',
    },
    created_at: new Date().toISOString(),
  })

  revalidatePath(`/liquidity/${companyId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// uploadBankFile — Saves file metadata to bank_upload_files
// ---------------------------------------------------------------------------

export async function uploadBankFile(input: UploadBankFileInput): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Nicht authentifiziert.' }
  }

  const hasFinancePerm =
    session.isHoldingAdmin || session.permissions.includes('module:finance:read')
  if (!hasFinancePerm) {
    return { success: false, error: 'Keine Berechtigung.' }
  }

  const parsed = UploadBankFileSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Ungueltige Eingabedaten.' }
  }

  const { companyId, filename, fileFormat, storagePath, periodFrom, periodTo, transactionCount } =
    parsed.data

  if (!session.isHoldingAdmin && session.companyId !== companyId) {
    return { success: false, error: 'Kein Zugriff auf dieses Unternehmen.' }
  }

  const supabase = createSupabaseServerClient()

  // Fetch holding_id
  const { data: company } = await supabase
    .from('companies')
    .select('holding_id')
    .eq('id', companyId)
    .single()

  if (!company) {
    return { success: false, error: 'Unternehmen nicht gefunden.' }
  }

  const holdingId = (company as Record<string, unknown>)['holding_id'] as string

  const { error: insertErr } = await supabase.from('bank_upload_files').insert({
    holding_id: holdingId,
    company_id: companyId,
    filename,
    file_format: fileFormat,
    storage_path: storagePath,
    period_from: periodFrom,
    period_to: periodTo,
    transaction_count: transactionCount,
    uploaded_by: session.profile.id,
  })

  if (insertErr) {
    return { success: false, error: `Fehler beim Speichern: ${insertErr.message}` }
  }

  // Audit log
  await supabase.from('audit_log').insert({
    company_id: companyId,
    actor_id: session.profile.id,
    action: 'liquidity.bank_upload',
    table_name: 'bank_upload_files',
    new_values: { filename, file_format: fileFormat, transaction_count: transactionCount },
    created_at: new Date().toISOString(),
  })

  revalidatePath(`/liquidity/${companyId}`)
  return { success: true }
}
