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
 * Map Leadnodes lead status to internal status.
 */
function mapLeadStatus(status: string | null | undefined): string {
  if (!status) return 'new'
  const s = status.toLowerCase()
  if (s === 'approved' || s === 'accepted') return 'qualified'
  if (s === 'pending' || s === 'new') return 'new'
  if (s === 'rejected' || s === 'declined') return 'lost'
  if (s === 'delivered') return 'contacted'
  return 'new'
}

/**
 * Build a notes string from the lead's custom data.
 */
function buildNotes(lead: LeadnotesLead): string | null {
  const parts: string[] = []
  parts.push('[Leadnodes]')

  if (lead.custom_data) {
    const herkunft = lead.custom_data['herkunft'] as string | undefined
    if (herkunft) parts.push(`Herkunft: ${herkunft}`)
  }

  if (lead.company) {
    parts.push(`Firma: ${lead.company}`)
  }

  return parts.length > 1 ? parts.join('\n') : null
}

/**
 * Transform a raw Leadnodes v2 lead into the shape expected by the leads table.
 */
export function normaliseLead(
  companyId: string,
  lead: LeadnotesLead,
): LeadInsert {
  // Extract source from custom_data if available
  const herkunft = (lead.custom_data?.['herkunft'] as string) ?? ''
  const source = herkunft ? mapLeadSource(herkunft) : 'leadnotes'

  return {
    company_id: companyId,
    external_id: String(lead.id),
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    address_street: lead.street_no ?? null,
    address_zip: lead.zip_code ?? null,
    address_city: lead.city ?? null,
    source,
    status: mapLeadStatus(lead.status),
    notes: buildNotes(lead),
    created_at: lead.created_at,
  }
}
