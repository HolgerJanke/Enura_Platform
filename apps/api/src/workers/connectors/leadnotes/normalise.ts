import type { LeadInsert, LeadSource } from '@enura/types'
import type { LeadnotesLead } from './schemas.js'

/**
 * Map a Leadnotes source string to the internal LeadSource enum.
 * Stores the original source in the notes field for traceability.
 */
function mapLeadSource(source: string): LeadSource {
  const s = source.toLowerCase()

  if (s.includes('website') || s.includes('web') || s.includes('online')) return 'website'
  if (s.includes('referral') || s.includes('empfehlung')) return 'referral'
  if (s.includes('partner')) return 'partner'
  if (s.includes('ad') || s.includes('werbung') || s.includes('facebook') || s.includes('google')) return 'advertising'
  if (s.includes('cold') || s.includes('kalt')) return 'cold_call'

  // Default: attribute to leadnotes as the integration source
  return 'leadnotes'
}

/**
 * Build a notes string that preserves the original Leadnotes source
 * and any message content from the lead.
 */
function buildNotes(lead: LeadnotesLead): string | null {
  const parts: string[] = []

  parts.push(`[Leadnotes] Source: ${lead.source}`)

  if (lead.source_detail) {
    parts.push(`Source detail: ${lead.source_detail}`)
  }

  if (lead.message) {
    parts.push(`Message: ${lead.message}`)
  }

  return parts.length > 0 ? parts.join('\n') : null
}

/**
 * Transform a raw Leadnotes lead into the shape expected by the leads table.
 */
export function normaliseLead(
  companyId: string,
  lead: LeadnotesLead,
): LeadInsert {
  return {
    company_id: companyId,
    external_id: lead.id,
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone,
    source: mapLeadSource(lead.source),
    status: 'new',
    notes: buildNotes(lead),
    created_at: lead.created_at,
  }
}
