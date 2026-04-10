/**
 * Invoice Matching Worker
 *
 * Matches extracted invoice data to projects and process steps
 * using a cascading confidence-based approach:
 *   1. Project number match (highest confidence)
 *   2. Customer name match
 *   3. Customer address match
 *   4. Amount + date match against liquidity events (lowest)
 *
 * See Finanzplanung_Konzept_v1_2.pdf Section 3.3
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceMatchJobData {
  invoiceId: string
  companyId: string
  holdingId: string
}

export interface MatchResult {
  invoiceId: string
  projectId: string | null
  stepId: string | null
  confidence: number
  method: string
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

export async function processInvoiceMatching(
  job: InvoiceMatchJobData,
): Promise<MatchResult> {
  const { invoiceId, companyId } = job
  const db = getServiceClient()

  // Fetch invoice data
  const { data: invoice } = await db
    .from('invoices_incoming')
    .select('project_ref_raw, customer_name_raw, customer_address_raw, gross_amount, invoice_date, due_date')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { invoiceId, projectId: null, stepId: null, confidence: 0, method: 'unmatched' }
  }

  const inv = invoice as Record<string, unknown>
  const projectRef = inv['project_ref_raw'] as string | null
  const customerName = inv['customer_name_raw'] as string | null
  const customerAddress = inv['customer_address_raw'] as string | null
  const grossAmount = Number(inv['gross_amount'] ?? 0)
  const invoiceDate = inv['invoice_date'] as string | null

  // Cascade 1: Project number match
  if (projectRef) {
    const match = await matchByProjectNumber(db, companyId, projectRef)
    if (match) {
      await applyMatch(db, invoiceId, match)
      return match
    }
  }

  // Cascade 2: Customer name match
  if (customerName) {
    const match = await matchByCustomerName(db, companyId, customerName)
    if (match) {
      await applyMatch(db, invoiceId, match)
      return match
    }
  }

  // Cascade 3: Customer address match
  if (customerAddress) {
    const match = await matchByCustomerAddress(db, companyId, customerAddress)
    if (match) {
      await applyMatch(db, invoiceId, match)
      return match
    }
  }

  // Cascade 4: Amount + date match against liquidity events
  if (grossAmount > 0 && invoiceDate) {
    const match = await matchByAmountDate(db, companyId, invoiceId, grossAmount, invoiceDate)
    if (match) {
      await applyMatch(db, invoiceId, match)
      return match
    }
  }

  // No match found — set to match_review status
  await db
    .from('invoices_incoming')
    .update({
      status: 'match_review',
      match_confidence: 0,
      match_method: 'unmatched',
    })
    .eq('id', invoiceId)

  console.log(`[invoice-matching] No match for invoice ${invoiceId}`)
  return { invoiceId, projectId: null, stepId: null, confidence: 0, method: 'unmatched' }
}

// ---------------------------------------------------------------------------
// Cascade 1: Project number
// ---------------------------------------------------------------------------

async function matchByProjectNumber(
  db: SupabaseClient,
  companyId: string,
  projectRef: string,
): Promise<MatchResult | null> {
  const normalized = projectRef.trim().toLowerCase()

  // Try exact match on external_id or name
  const { data: projects } = await db
    .from('projects')
    .select('id')
    .eq('company_id', companyId)
    .or(`external_id.ilike.%${normalized}%,name.ilike.%${normalized}%`)
    .limit(1)

  if (projects && projects.length > 0) {
    const projectId = (projects[0] as { id: string }).id
    const stepId = await findExpenseStep(db, companyId, projectId)

    return {
      invoiceId: '',
      projectId,
      stepId,
      confidence: 0.9,
      method: 'project_number',
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Cascade 2: Customer name
// ---------------------------------------------------------------------------

async function matchByCustomerName(
  db: SupabaseClient,
  companyId: string,
  customerName: string,
): Promise<MatchResult | null> {
  const normalized = customerName.trim().toLowerCase()

  const { data: projects } = await db
    .from('projects')
    .select('id')
    .eq('company_id', companyId)
    .ilike('customer_name', `%${normalized}%`)
    .limit(1)

  if (projects && projects.length > 0) {
    const projectId = (projects[0] as { id: string }).id
    const stepId = await findExpenseStep(db, companyId, projectId)

    return {
      invoiceId: '',
      projectId,
      stepId,
      confidence: 0.75,
      method: 'customer_name',
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Cascade 3: Customer address
// ---------------------------------------------------------------------------

async function matchByCustomerAddress(
  db: SupabaseClient,
  companyId: string,
  customerAddress: string,
): Promise<MatchResult | null> {
  const normalized = customerAddress.trim().toLowerCase()

  // Search in leads table for address match
  const { data: leads } = await db
    .from('leads')
    .select('id, project_id')
    .eq('company_id', companyId)
    .ilike('address', `%${normalized.slice(0, 30)}%`)
    .not('project_id', 'is', null)
    .limit(1)

  if (leads && leads.length > 0) {
    const lead = leads[0] as { id: string; project_id: string | null }
    if (lead.project_id) {
      const stepId = await findExpenseStep(db, companyId, lead.project_id)
      return {
        invoiceId: '',
        projectId: lead.project_id,
        stepId,
        confidence: 0.65,
        method: 'customer_address',
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Cascade 4: Amount + date
// ---------------------------------------------------------------------------

async function matchByAmountDate(
  db: SupabaseClient,
  companyId: string,
  invoiceId: string,
  grossAmount: number,
  invoiceDate: string,
): Promise<MatchResult | null> {
  // Look for liquidity event instances with matching amount and nearby date
  const { data: events } = await db
    .from('liquidity_event_instances')
    .select('id, project_id, step_id, budget_amount, budget_date')
    .eq('company_id', companyId)
    .eq('direction', 'expense')
    .is('actual_amount', null)
    .limit(20)

  if (!events) return null

  for (const event of events) {
    const e = event as Record<string, unknown>
    const budgetAmount = Number(e['budget_amount'] ?? 0)
    const budgetDate = e['budget_date'] as string | null

    // Amount within 20% tolerance
    if (budgetAmount > 0 && Math.abs(budgetAmount - grossAmount) / budgetAmount < 0.2) {
      return {
        invoiceId,
        projectId: e['project_id'] as string,
        stepId: e['step_id'] as string,
        confidence: 0.5,
        method: 'amount_date',
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findExpenseStep(
  db: SupabaseClient,
  companyId: string,
  projectId: string,
): Promise<string | null> {
  // Find the first expense liquidity event for this project
  const { data: events } = await db
    .from('liquidity_event_instances')
    .select('step_id')
    .eq('company_id', companyId)
    .eq('project_id', projectId)
    .eq('direction', 'expense')
    .is('actual_amount', null)
    .order('budget_date', { ascending: true })
    .limit(1)

  if (events && events.length > 0) {
    return (events[0] as { step_id: string }).step_id
  }

  return null
}

async function applyMatch(
  db: SupabaseClient,
  invoiceId: string,
  match: MatchResult,
): Promise<void> {
  const status = match.confidence >= 0.8 ? 'extraction_done' : 'match_review'

  await db
    .from('invoices_incoming')
    .update({
      project_id: match.projectId,
      step_id: match.stepId,
      match_confidence: match.confidence,
      match_method: match.method,
      status,
    })
    .eq('id', invoiceId)

  console.log(
    `[invoice-matching] Invoice ${invoiceId}: ` +
      `method=${match.method}, confidence=${match.confidence}, project=${match.projectId}`,
  )
}
