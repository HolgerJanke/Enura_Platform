'use server'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Invoice validation actions
// ---------------------------------------------------------------------------

export async function performValidationAction(
  invoiceId: string,
  step: 1 | 2 | 3,
  action: string,
  comment?: string,
  plannedDateOverride?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Nicht authentifiziert.' }

  const hasValidate = session.isHoldingAdmin || session.permissions.includes('module:finanzplanung:validate')
  const hasApprove = session.isHoldingAdmin || session.permissions.includes('module:finanzplanung:approve_invoice')

  if (step <= 2 && !hasValidate) return { success: false, error: 'Keine Berechtigung zum Prüfen.' }
  if (step === 3 && !hasApprove) return { success: false, error: 'Keine Berechtigung zum Genehmigen.' }

  const supabase = createSupabaseServerClient()

  // Insert validation log entry (append-only)
  const { error: valError } = await supabase
    .from('invoice_validations')
    .insert({
      invoice_id: invoiceId,
      holding_id: session.holdingId ?? '',
      company_id: session.companyId ?? '',
      validation_step: step,
      action,
      actor_id: session.profile.id,
      comment: comment ?? null,
      planned_date_override: plannedDateOverride ?? null,
      approval_channel: 'platform',
    })

  if (valError) return { success: false, error: valError.message }

  // Update invoice status based on action
  const statusMap: Record<string, string> = {
    formal_pass: 'in_validation',
    formal_return: 'returned_formal',
    content_pass: 'formally_approved',
    due_date_override: 'formally_approved',
    content_return: 'returned_sender',
    approve: 'approved',
    reject: 'returned_internal',
    internal_fix: 'pending_approval',
    return_after_reject: 'returned_sender',
  }

  const newStatus = statusMap[action]
  if (newStatus) {
    // For step 2 content_pass, move to pending_approval (awaiting step 3)
    const finalStatus = action === 'content_pass' ? 'pending_approval' : newStatus

    const updatePayload: Record<string, unknown> = { status: finalStatus }
    if (plannedDateOverride) {
      updatePayload['due_date'] = plannedDateOverride
    }

    await supabase
      .from('invoices_incoming')
      .update(updatePayload)
      .eq('id', invoiceId)
  }

  // Send notification for return actions
  const isReturn = ['formal_return', 'content_return', 'reject', 'return_after_reject'].includes(action)
  if (isReturn) {
    // Fetch invoice details for notification
    const { data: inv } = await supabase
      .from('invoices_incoming')
      .select('invoice_number, sender_name, gross_amount, currency')
      .eq('id', invoiceId)
      .single()

    if (inv) {
      const invData = inv as Record<string, unknown>
      await notifyInvoiceReturned({
        invoiceId,
        invoiceNumber: String(invData['invoice_number'] ?? ''),
        senderName: String(invData['sender_name'] ?? 'Unbekannt'),
        amount: Number(invData['gross_amount'] ?? 0),
        currency: String(invData['currency'] ?? 'CHF'),
        reason: comment ?? 'Keine Begründung angegeben.',
        step,
        actorName: session.profile.display_name ?? 'Unbekannt',
        companyId: session.companyId ?? '',
      })
    }
  }

  revalidatePath(`/finanzplanung/eingang/${invoiceId}`)
  revalidatePath('/finanzplanung/eingang')
  revalidatePath('/finanzplanung')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Invoice return notification
// ---------------------------------------------------------------------------

interface ReturnNotification {
  invoiceId: string
  invoiceNumber: string
  senderName: string
  amount: number
  currency: string
  reason: string
  step: number
  actorName: string
  companyId: string
}

async function notifyInvoiceReturned(data: ReturnNotification): Promise<void> {
  // TODO: Wire up Resend when RESEND_API_KEY is available
  // For now, log the notification and store it in the database
  const stepLabels: Record<number, string> = {
    1: 'Formale Prüfung',
    2: 'Inhaltliche Prüfung',
    3: 'Technische Genehmigung',
  }

  console.log(
    `[Invoice Return Notification] ${data.invoiceNumber} (${data.senderName}, ${data.currency} ${data.amount.toFixed(2)}) ` +
    `zurückgesendet bei ${stepLabels[data.step] ?? `Schritt ${data.step}`} von ${data.actorName}. ` +
    `Grund: ${data.reason}`,
  )

  // When Resend is configured, send email:
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({
  //   from: 'Finanzplanung <noreply@enura-group.com>',
  //   to: [uploaderEmail],
  //   subject: `Rechnung ${data.invoiceNumber} zurückgesendet`,
  //   html: `<p>Die Rechnung <b>${data.invoiceNumber}</b> von ${data.senderName} wurde bei
  //          "${stepLabels[data.step]}" zurückgesendet.</p>
  //          <p><b>Grund:</b> ${data.reason}</p>
  //          <p><b>Geprüft von:</b> ${data.actorName}</p>
  //          <p><a href="https://www.enura-group.com/finanzplanung/eingang/${data.invoiceId}">Rechnung ansehen</a></p>`,
  // })
}

// ---------------------------------------------------------------------------
// Manual project match
// ---------------------------------------------------------------------------

export async function updateInvoiceMatch(
  invoiceId: string,
  projectId: string,
  stepId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Nicht authentifiziert.' }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('invoices_incoming')
    .update({
      project_id: projectId,
      step_id: stepId,
      match_method: 'manual',
      match_confidence: 1.0,
      status: 'in_validation',
    })
    .eq('id', invoiceId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/finanzplanung/eingang/${invoiceId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Supplier CRUD
// ---------------------------------------------------------------------------

export async function createSupplier(
  data: {
    name: string
    city?: string
    country?: string
    vat_number?: string
    iban?: string
    bic?: string
    bank_name?: string
    contact_name?: string
    contact_email?: string
    contact_phone?: string
    preferred_payment_days?: number
  },
): Promise<{ success: boolean; error?: string; id?: string }> {
  const session = await getSession()
  if (!session?.companyId) return { success: false, error: 'Nicht authentifiziert.' }

  const hasPermission = session.isHoldingAdmin || session.permissions.includes('module:finanzplanung:manage_suppliers')
  if (!hasPermission) return { success: false, error: 'Keine Berechtigung.' }

  // Use service client — the protect_supplier_bank_fields trigger blocks direct
  // IBAN writes from non-service-role connections
  const supabase = createSupabaseServiceClient()
  const { data: row, error } = await supabase
    .from('suppliers')
    .insert({
      holding_id: session.holdingId ?? '',
      company_id: session.companyId,
      name: data.name,
      city: data.city ?? null,
      country: data.country ?? 'CH',
      vat_number: data.vat_number ?? null,
      iban: null,  // Bank data goes through approval workflow
      bic: null,
      bank_name: null,
      bank_data_verified: false,
      contact_name: data.contact_name ?? null,
      contact_email: data.contact_email ?? null,
      contact_phone: data.contact_phone ?? null,
      preferred_payment_days: data.preferred_payment_days ?? 30,
      created_by: session.profile.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  const supplierId = (row as { id: string }).id

  // If IBAN was provided, automatically create a bank data change request
  if (data.iban) {
    await supabase.from('supplier_bank_change_requests').insert({
      supplier_id: supplierId,
      holding_id: session.holdingId ?? '',
      company_id: session.companyId,
      proposed_iban: data.iban,
      proposed_bic: data.bic ?? null,
      proposed_bank_name: data.bank_name ?? null,
      reason: 'Erstanlage Lieferant',
      source: 'internal',
      status: 'pending_review',
      requested_by: session.profile.id,
    })

    await supabase.from('supplier_bank_change_log').insert({
      holding_id: session.holdingId ?? '',
      company_id: session.companyId,
      action: 'created',
      actor_id: session.profile.id,
      new_status: 'pending_review',
      metadata: { source: 'supplier_creation', iban_last4: data.iban.slice(-4) },
    })
  }

  revalidatePath('/finanzplanung/lieferanten')
  return { success: true, id: supplierId }
}

// ---------------------------------------------------------------------------
// Payment run actions
// ---------------------------------------------------------------------------

export async function createPaymentRun(
  runDate: string,
  invoiceIds: string[],
): Promise<{ success: boolean; error?: string; runId?: string }> {
  const session = await getSession()
  if (!session?.companyId) return { success: false, error: 'Nicht authentifiziert.' }

  const hasPlan = session.isHoldingAdmin || session.permissions.includes('module:finanzplanung:plan_cashout')
  if (!hasPlan) return { success: false, error: 'Keine Berechtigung.' }

  const supabase = createSupabaseServerClient()

  // Fetch invoices with supplier data
  const { data: invoices } = await supabase
    .from('invoices_incoming')
    .select('id, gross_amount, currency, invoice_number, supplier_id, sender_name')
    .in('id', invoiceIds)
    .eq('status', 'approved')

  if (!invoices || invoices.length === 0) {
    return { success: false, error: 'Keine genehmigten Rechnungen ausgewählt.' }
  }

  const totalAmount = invoices.reduce((sum, inv) => sum + Number((inv as Record<string, unknown>)['gross_amount'] ?? 0), 0)

  // Create payment run
  const { data: run, error: runError } = await supabase
    .from('payment_runs')
    .insert({
      holding_id: session.holdingId ?? '',
      company_id: session.companyId,
      run_date: runDate,
      name: `Zahlungslauf ${runDate}`,
      created_by: session.profile.id,
      total_amount: totalAmount,
      item_count: invoices.length,
      currency: 'CHF',
      status: 'draft',
    })
    .select('id')
    .single()

  if (runError || !run) return { success: false, error: runError?.message ?? 'Fehler beim Erstellen.' }

  const runId = (run as { id: string }).id

  // Look up verified bank data for each supplier
  const supplierIds = [...new Set(
    invoices
      .map((inv) => (inv as Record<string, unknown>)['supplier_id'] as string | null)
      .filter((id): id is string => id !== null)
  )]

  let bankDataMap: Record<string, { id: string; iban: string; bic: string | null }> = {}
  if (supplierIds.length > 0) {
    const { data: bankRows } = await supabase
      .from('supplier_bank_data')
      .select('id, supplier_id, iban, bic')
      .in('supplier_id', supplierIds)
      .eq('is_active', true)

    for (const bd of (bankRows ?? []) as Array<{ id: string; supplier_id: string; iban: string; bic: string | null }>) {
      bankDataMap[bd.supplier_id] = { id: bd.id, iban: bd.iban, bic: bd.bic }
    }
  }

  // Check that all invoices have suppliers with verified bank data
  const unverified: string[] = []
  for (const inv of invoices) {
    const record = inv as Record<string, unknown>
    const supplierId = record['supplier_id'] as string | null
    if (!supplierId || !bankDataMap[supplierId]) {
      unverified.push((record['sender_name'] as string) ?? (record['invoice_number'] as string) ?? 'Unbekannt')
    }
  }

  if (unverified.length > 0) {
    return {
      success: false,
      error: `Folgende Rechnungen haben Lieferanten ohne verifizierte Bankdaten: ${unverified.join(', ')}. Bankdaten muessen zuerst genehmigt werden.`,
    }
  }

  // Create payment run items with verified bank data
  const items = invoices.map((inv, i) => {
    const record = inv as Record<string, unknown>
    const supplierId = record['supplier_id'] as string
    const bankData = bankDataMap[supplierId]!
    return {
      run_id: runId,
      holding_id: session.holdingId ?? '',
      company_id: session.companyId ?? '',
      invoice_id: record['id'] as string,
      supplier_id: supplierId,
      creditor_name: (record['sender_name'] as string) ?? 'Unbekannt',
      creditor_iban: bankData.iban,
      creditor_bic: bankData.bic,
      bank_data_id: bankData.id,
      amount: Number(record['gross_amount'] ?? 0),
      currency: (record['currency'] as string) ?? 'CHF',
      payment_reference: (record['invoice_number'] as string) ?? null,
      sort_order: i,
    }
  })

  await supabase.from('payment_run_items').insert(items)

  // Update invoice statuses
  await supabase
    .from('invoices_incoming')
    .update({ status: 'in_payment_run' })
    .in('id', invoiceIds)

  revalidatePath('/finanzplanung/planung')
  revalidatePath('/finanzplanung')
  return { success: true, runId }
}

export async function submitPaymentRun(
  runId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Nicht authentifiziert.' }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('payment_runs')
    .update({
      status: 'submitted',
      submitted_by: session.profile.id,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .eq('status', 'draft')

  if (error) return { success: false, error: error.message }

  revalidatePath('/finanzplanung/planung')
  return { success: true }
}

export async function approvePaymentRun(
  runId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Nicht authentifiziert.' }

  const hasApprove = session.isHoldingAdmin || session.permissions.includes('module:finanzplanung:approve_payment')
  if (!hasApprove) return { success: false, error: 'Keine Berechtigung.' }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('payment_runs')
    .update({
      status: 'approved',
      approved_by: session.profile.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .in('status', ['submitted', 'under_review'])

  if (error) return { success: false, error: error.message }

  revalidatePath('/finanzplanung/planung')
  revalidatePath('/finanzplanung/genehmigung')
  return { success: true }
}

export async function rejectPaymentRun(
  runId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Nicht authentifiziert.' }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('payment_runs')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      approved_by: session.profile.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', runId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/finanzplanung/planung')
  revalidatePath('/finanzplanung/genehmigung')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Schedule invoice payment date (drag-and-drop in calendar)
// ---------------------------------------------------------------------------

export async function scheduleInvoicePayment(
  invoiceId: string,
  scheduledDate: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Nicht authentifiziert.' }

  const hasPlan = session.isHoldingAdmin || session.isEnuraAdmin || session.permissions.includes('module:finanzplanung:plan_cashout')
  if (!hasPlan) return { success: false, error: 'Keine Berechtigung.' }

  // Use service client to bypass RLS (permission already checked above)
  const supabase = createSupabaseServiceClient()

  // Update planned_payment_date (due_date stays as the supplier's original term)
  const { error } = await supabase
    .from('invoices_incoming')
    .update({ planned_payment_date: scheduledDate })
    .eq('id', invoiceId)

  if (error) return { success: false, error: error.message }

  // Update linked liquidity_event_instance scheduled date
  await supabase
    .from('liquidity_event_instances')
    .update({
      scheduled_date: scheduledDate,
      scheduled_by: session.profile.id,
      scheduled_at: new Date().toISOString(),
    })
    .eq('invoice_id', invoiceId)

  revalidatePath('/finanzplanung/planung')
  revalidatePath('/finanzplanung/eingang')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Bank data change request actions
// ---------------------------------------------------------------------------

export async function requestBankDataChange(
  supplierId: string,
  data: {
    proposed_iban: string
    proposed_bic?: string
    proposed_bank_name?: string
    reason: string
    source: 'internal' | 'supplier_request' | 'invoice_mismatch'
    evidence_storage_path?: string
    is_urgent?: boolean
    urgent_justification?: string
  },
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  const session = await getSession()
  if (!session?.companyId) return { success: false, error: 'Nicht authentifiziert.' }

  const hasPermission = session.isHoldingAdmin || session.permissions.includes('module:finanzplanung:manage_suppliers')
  if (!hasPermission) return { success: false, error: 'Keine Berechtigung.' }

  const supabase = createSupabaseServerClient()

  // Check no pending request exists for this supplier
  const { data: existing } = await supabase
    .from('supplier_bank_change_requests')
    .select('id')
    .eq('supplier_id', supplierId)
    .in('status', ['pending_review', 'reviewed'])
    .limit(1)

  if (existing && existing.length > 0) {
    return { success: false, error: 'Es liegt bereits eine offene Aenderungsanfrage fuer diesen Lieferanten vor.' }
  }

  const { data: row, error } = await supabase
    .from('supplier_bank_change_requests')
    .insert({
      supplier_id: supplierId,
      holding_id: session.holdingId ?? '',
      company_id: session.companyId,
      proposed_iban: data.proposed_iban,
      proposed_bic: data.proposed_bic ?? null,
      proposed_bank_name: data.proposed_bank_name ?? null,
      reason: data.reason,
      source: data.source,
      evidence_storage_path: data.evidence_storage_path ?? null,
      status: 'pending_review',
      requested_by: session.profile.id,
      is_urgent: data.is_urgent ?? false,
      urgent_justification: data.urgent_justification ?? null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  const requestId = (row as { id: string }).id

  // Write audit log entry
  await supabase.from('supplier_bank_change_log').insert({
    request_id: requestId,
    holding_id: session.holdingId ?? '',
    company_id: session.companyId,
    action: 'created',
    actor_id: session.profile.id,
    new_status: 'pending_review',
    metadata: { iban_last4: data.proposed_iban.slice(-4) },
  })

  revalidatePath('/finanzplanung/bankdaten-genehmigung')
  revalidatePath(`/finanzplanung/lieferanten/${supplierId}`)
  return { success: true, requestId }
}

export async function reviewBankDataChange(
  requestId: string,
  action: 'review' | 'reject',
  comment?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session?.companyId) return { success: false, error: 'Nicht authentifiziert.' }

  const hasPermission = session.isHoldingAdmin || session.permissions.includes('module:finanzplanung:review_bank_data')
  if (!hasPermission) return { success: false, error: 'Keine Berechtigung fuer Bankdatenpruefung.' }

  const supabase = createSupabaseServerClient()

  // Fetch request
  const { data: req } = await supabase
    .from('supplier_bank_change_requests')
    .select('id, status, requested_by, supplier_id')
    .eq('id', requestId)
    .single()

  if (!req) return { success: false, error: 'Antrag nicht gefunden.' }
  const request = req as { id: string; status: string; requested_by: string; supplier_id: string }

  if (request.status !== 'pending_review') {
    return { success: false, error: 'Antrag ist nicht im Status "Zu pruefen".' }
  }

  // 4-eyes: reviewer must not be the requester
  if (request.requested_by === session.profile.id) {
    return { success: false, error: '4-Augen-Prinzip: Sie koennen Ihren eigenen Antrag nicht pruefen.' }
  }

  const newStatus = action === 'review' ? 'reviewed' : 'rejected'

  const updateData: Record<string, unknown> = { status: newStatus }
  if (action === 'review') {
    updateData['reviewed_by'] = session.profile.id
    updateData['reviewed_at'] = new Date().toISOString()
    updateData['review_comment'] = comment ?? null
  } else {
    updateData['rejected_by'] = session.profile.id
    updateData['rejected_at'] = new Date().toISOString()
    updateData['rejection_reason'] = comment ?? null
  }

  const { error } = await supabase
    .from('supplier_bank_change_requests')
    .update(updateData)
    .eq('id', requestId)

  if (error) return { success: false, error: error.message }

  await supabase.from('supplier_bank_change_log').insert({
    request_id: requestId,
    holding_id: session.holdingId ?? '',
    company_id: session.companyId,
    action: action === 'review' ? 'reviewed' : 'rejected',
    actor_id: session.profile.id,
    old_status: 'pending_review',
    new_status: newStatus,
    comment: comment ?? null,
  })

  revalidatePath('/finanzplanung/bankdaten-genehmigung')
  revalidatePath(`/finanzplanung/lieferanten/${request.supplier_id}`)
  return { success: true }
}

export async function approveBankDataChange(
  requestId: string,
  action: 'approve' | 'reject',
  comment?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session?.companyId) return { success: false, error: 'Nicht authentifiziert.' }

  const hasPermission = session.isHoldingAdmin || session.permissions.includes('module:finanzplanung:approve_bank_data')
  if (!hasPermission) return { success: false, error: 'Keine Berechtigung fuer Bankdaten-Genehmigung.' }

  const supabase = createSupabaseServerClient()
  const serviceClient = createSupabaseServiceClient()

  // Fetch request
  const { data: req } = await supabase
    .from('supplier_bank_change_requests')
    .select('id, status, requested_by, reviewed_by, supplier_id, proposed_iban, proposed_bic, proposed_bank_name')
    .eq('id', requestId)
    .single()

  if (!req) return { success: false, error: 'Antrag nicht gefunden.' }
  const request = req as {
    id: string; status: string; requested_by: string; reviewed_by: string | null
    supplier_id: string; proposed_iban: string; proposed_bic: string | null; proposed_bank_name: string | null
  }

  if (request.status !== 'reviewed') {
    return { success: false, error: 'Antrag ist nicht im Status "Geprueft".' }
  }

  // 4-eyes: approver must not be requester or reviewer
  if (request.requested_by === session.profile.id) {
    return { success: false, error: '4-Augen-Prinzip: Sie koennen Ihren eigenen Antrag nicht genehmigen.' }
  }
  if (request.reviewed_by === session.profile.id) {
    return { success: false, error: '4-Augen-Prinzip: Pruefer und Genehmiger muessen unterschiedliche Personen sein.' }
  }

  if (action === 'reject') {
    const { error } = await supabase
      .from('supplier_bank_change_requests')
      .update({
        status: 'rejected',
        rejected_by: session.profile.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: comment ?? null,
      })
      .eq('id', requestId)

    if (error) return { success: false, error: error.message }

    await supabase.from('supplier_bank_change_log').insert({
      request_id: requestId,
      holding_id: session.holdingId ?? '',
      company_id: session.companyId,
      action: 'rejected',
      actor_id: session.profile.id,
      old_status: 'reviewed',
      new_status: 'rejected',
      comment: comment ?? null,
    })

    revalidatePath('/finanzplanung/bankdaten-genehmigung')
    revalidatePath(`/finanzplanung/lieferanten/${request.supplier_id}`)
    return { success: true }
  }

  // APPROVE — activate new bank data
  // 1. Get current max version for this supplier
  const { data: maxVersionRow } = await serviceClient
    .from('supplier_bank_data')
    .select('version')
    .eq('supplier_id', request.supplier_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = ((maxVersionRow as { version: number } | null)?.version ?? -1) + 1

  // 2. Deactivate current active bank data
  await serviceClient
    .from('supplier_bank_data')
    .update({ is_active: false, deactivated_at: new Date().toISOString() })
    .eq('supplier_id', request.supplier_id)
    .eq('is_active', true)

  // 3. Insert new bank data version
  const { data: newBankData, error: bdError } = await serviceClient
    .from('supplier_bank_data')
    .insert({
      supplier_id: request.supplier_id,
      holding_id: session.holdingId ?? '',
      company_id: session.companyId,
      version: nextVersion,
      iban: request.proposed_iban,
      bic: request.proposed_bic,
      bank_name: request.proposed_bank_name,
      is_active: true,
      activated_at: new Date().toISOString(),
      created_by: session.profile.id,
    })
    .select('id')
    .single()

  if (bdError || !newBankData) return { success: false, error: bdError?.message ?? 'Fehler bei Bankdaten-Aktivierung.' }

  const bankDataId = (newBankData as { id: string }).id

  // 4. Update supplier master record (via service client to bypass trigger)
  await serviceClient
    .from('suppliers')
    .update({
      iban: request.proposed_iban,
      bic: request.proposed_bic,
      bank_name: request.proposed_bank_name,
      bank_data_verified: true,
      active_bank_data_id: bankDataId,
    })
    .eq('id', request.supplier_id)

  // 5. Update the change request
  await serviceClient
    .from('supplier_bank_change_requests')
    .update({
      status: 'approved',
      approved_by: session.profile.id,
      approved_at: new Date().toISOString(),
      approval_comment: comment ?? null,
      resulting_bank_data_id: bankDataId,
    })
    .eq('id', requestId)

  // 6. Write audit log
  await supabase.from('supplier_bank_change_log').insert({
    request_id: requestId,
    holding_id: session.holdingId ?? '',
    company_id: session.companyId,
    action: 'approved',
    actor_id: session.profile.id,
    old_status: 'reviewed',
    new_status: 'approved',
    comment: comment ?? null,
    metadata: { bank_data_id: bankDataId, version: nextVersion },
  })

  await supabase.from('supplier_bank_change_log').insert({
    request_id: requestId,
    holding_id: session.holdingId ?? '',
    company_id: session.companyId,
    action: 'activated',
    actor_id: session.profile.id,
    new_status: 'approved',
    metadata: { bank_data_id: bankDataId, iban_last4: request.proposed_iban.slice(-4) },
  })

  revalidatePath('/finanzplanung/bankdaten-genehmigung')
  revalidatePath(`/finanzplanung/lieferanten/${request.supplier_id}`)
  revalidatePath('/finanzplanung/lieferanten')
  return { success: true }
}

export async function cancelBankDataChange(
  requestId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session?.companyId) return { success: false, error: 'Nicht authentifiziert.' }

  const supabase = createSupabaseServerClient()

  const { data: req } = await supabase
    .from('supplier_bank_change_requests')
    .select('id, status, requested_by, supplier_id')
    .eq('id', requestId)
    .single()

  if (!req) return { success: false, error: 'Antrag nicht gefunden.' }
  const request = req as { id: string; status: string; requested_by: string; supplier_id: string }

  if (!['pending_review', 'reviewed'].includes(request.status)) {
    return { success: false, error: 'Antrag kann nicht mehr storniert werden.' }
  }

  // Only the requester can cancel
  if (request.requested_by !== session.profile.id && !session.isHoldingAdmin) {
    return { success: false, error: 'Nur der Antragsteller kann diesen Antrag stornieren.' }
  }

  const { error } = await supabase
    .from('supplier_bank_change_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)

  if (error) return { success: false, error: error.message }

  await supabase.from('supplier_bank_change_log').insert({
    request_id: requestId,
    holding_id: session.holdingId ?? '',
    company_id: session.companyId,
    action: 'cancelled',
    actor_id: session.profile.id,
    old_status: request.status,
    new_status: 'cancelled',
  })

  revalidatePath('/finanzplanung/bankdaten-genehmigung')
  revalidatePath(`/finanzplanung/lieferanten/${request.supplier_id}`)
  return { success: true }
}
