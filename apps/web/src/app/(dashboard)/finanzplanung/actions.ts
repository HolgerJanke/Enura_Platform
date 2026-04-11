'use server'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
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

  revalidatePath(`/finanzplanung/eingang/${invoiceId}`)
  revalidatePath('/finanzplanung/eingang')
  revalidatePath('/finanzplanung')
  return { success: true }
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

  const supabase = createSupabaseServerClient()
  const { data: row, error } = await supabase
    .from('suppliers')
    .insert({
      holding_id: session.holdingId ?? '',
      company_id: session.companyId,
      name: data.name,
      city: data.city ?? null,
      country: data.country ?? 'CH',
      vat_number: data.vat_number ?? null,
      iban: data.iban ?? null,
      bic: data.bic ?? null,
      bank_name: data.bank_name ?? null,
      contact_name: data.contact_name ?? null,
      contact_email: data.contact_email ?? null,
      contact_phone: data.contact_phone ?? null,
      preferred_payment_days: data.preferred_payment_days ?? 30,
      created_by: session.profile.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/finanzplanung/lieferanten')
  return { success: true, id: (row as { id: string }).id }
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

  // Create payment run items
  const items = invoices.map((inv, i) => {
    const record = inv as Record<string, unknown>
    return {
      run_id: runId,
      holding_id: session.holdingId ?? '',
      company_id: session.companyId ?? '',
      invoice_id: record['id'] as string,
      supplier_id: (record['supplier_id'] as string) ?? null,
      creditor_name: (record['sender_name'] as string) ?? 'Unbekannt',
      creditor_iban: '',
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

  const hasPlan = session.isHoldingAdmin || session.permissions.includes('module:finanzplanung:plan_cashout')
  if (!hasPlan) return { success: false, error: 'Keine Berechtigung.' }

  const supabase = createSupabaseServerClient()

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
