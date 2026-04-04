import { createClient } from '@supabase/supabase-js'
import type { LeadnotesLead } from './schemas.js'

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Check which leads already exist in the tenant's leads table by email or phone.
 * Returns the subset of leads that are new (not duplicates).
 */
export async function deduplicateLeads(
  companyId: string,
  leads: LeadnotesLead[],
): Promise<{ newLeads: LeadnotesLead[]; duplicateCount: number }> {
  if (leads.length === 0) {
    return { newLeads: [], duplicateCount: 0 }
  }

  const db = getServiceClient()

  // Collect all non-null emails and phones from the incoming batch
  const emails = leads
    .map((l) => l.email)
    .filter((e): e is string => e !== null && e !== undefined && e.length > 0)

  const phones = leads
    .map((l) => l.phone)
    .filter((p): p is string => p !== null && p !== undefined && p.length > 0)

  // Also check external_id to avoid re-importing the same Leadnotes lead
  const externalIds = leads.map((l) => l.id)

  // Fetch existing leads that match by external_id
  const existingByExternalId = new Set<string>()
  if (externalIds.length > 0) {
    const { data: extMatches } = await db
      .from('leads')
      .select('external_id')
      .eq('company_id', companyId)
      .in('external_id', externalIds)

    for (const match of extMatches ?? []) {
      if (match.external_id) {
        existingByExternalId.add(match.external_id)
      }
    }
  }

  // Fetch existing leads that match by email
  const existingEmails = new Set<string>()
  if (emails.length > 0) {
    const { data: emailMatches } = await db
      .from('leads')
      .select('email')
      .eq('company_id', companyId)
      .in('email', emails)

    for (const match of emailMatches ?? []) {
      if (match.email) {
        existingEmails.add(match.email.toLowerCase())
      }
    }
  }

  // Fetch existing leads that match by phone
  const existingPhones = new Set<string>()
  if (phones.length > 0) {
    const { data: phoneMatches } = await db
      .from('leads')
      .select('phone')
      .eq('company_id', companyId)
      .in('phone', phones)

    for (const match of phoneMatches ?? []) {
      if (match.phone) {
        existingPhones.add(normalisePhone(match.phone))
      }
    }
  }

  // Filter out duplicates
  const newLeads: LeadnotesLead[] = []
  let duplicateCount = 0

  for (const lead of leads) {
    // Check external_id first (exact match from previous syncs)
    if (existingByExternalId.has(lead.id)) {
      duplicateCount++
      continue
    }

    // Check email match
    if (lead.email && existingEmails.has(lead.email.toLowerCase())) {
      duplicateCount++
      continue
    }

    // Check phone match
    if (lead.phone && existingPhones.has(normalisePhone(lead.phone))) {
      duplicateCount++
      continue
    }

    newLeads.push(lead)
  }

  return { newLeads, duplicateCount }
}

/**
 * Normalise a phone number by stripping whitespace and common separators.
 */
function normalisePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, '')
}
