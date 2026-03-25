import type { ReonicUser, ReonicLead, ReonicOffer } from './schemas.js'

// ---------------------------------------------------------------------------
// Status / role mapping helpers
// ---------------------------------------------------------------------------

const LEAD_STATUS_MAP: Record<string, string> = {
  new: 'new',
  neu: 'new',
  contacted: 'contacted',
  kontaktiert: 'contacted',
  qualified: 'qualified',
  qualifiziert: 'qualified',
  appointment: 'appointment_set',
  appointment_set: 'appointment_set',
  termin: 'appointment_set',
  won: 'won',
  gewonnen: 'won',
  lost: 'lost',
  verloren: 'lost',
  invalid: 'invalid',
  ungueltig: 'invalid',
}

const LEAD_SOURCE_MAP: Record<string, string> = {
  website: 'website',
  referral: 'referral',
  empfehlung: 'referral',
  partner: 'partner',
  advertising: 'advertising',
  werbung: 'advertising',
  cold_call: 'cold_call',
  kaltakquise: 'cold_call',
  leadnotes: 'leadnotes',
}

const OFFER_STATUS_MAP: Record<string, string> = {
  draft: 'draft',
  entwurf: 'draft',
  sent: 'sent',
  gesendet: 'sent',
  negotiating: 'negotiating',
  verhandlung: 'negotiating',
  won: 'won',
  gewonnen: 'won',
  lost: 'lost',
  verloren: 'lost',
  expired: 'expired',
  abgelaufen: 'expired',
}

const ROLE_TYPE_MAP: Record<string, string> = {
  setter: 'setter',
  berater: 'berater',
  advisor: 'berater',
  consultant: 'berater',
  innendienst: 'innendienst',
  backoffice: 'innendienst',
  bau: 'bau',
  montage: 'bau',
  teamleiter: 'teamleiter',
  team_lead: 'teamleiter',
  geschaeftsfuehrung: 'geschaeftsfuehrung',
  management: 'geschaeftsfuehrung',
  buchhaltung: 'buchhaltung',
  accounting: 'buchhaltung',
}

function mapLeadStatus(raw: string): string {
  return LEAD_STATUS_MAP[raw.toLowerCase()] ?? 'new'
}

function mapLeadSource(raw: string | null | undefined): string {
  if (!raw) return 'other'
  return LEAD_SOURCE_MAP[raw.toLowerCase()] ?? 'other'
}

function mapOfferStatus(raw: string): string {
  return OFFER_STATUS_MAP[raw.toLowerCase()] ?? 'draft'
}

function mapRoleType(raw: string): string {
  return ROLE_TYPE_MAP[raw.toLowerCase()] ?? raw.toLowerCase()
}

// ---------------------------------------------------------------------------
// Normalise functions
// ---------------------------------------------------------------------------

export function normaliseUser(
  user: ReonicUser,
  tenantId: string,
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    external_id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role_type: mapRoleType(user.role),
    is_active: user.active,
    updated_at: new Date().toISOString(),
  }
}

export function normaliseLead(
  lead: ReonicLead,
  tenantId: string,
  memberMap: Map<string, string>,
): Record<string, unknown> {
  const setterId = lead.assigned_to ? memberMap.get(lead.assigned_to) ?? null : null

  return {
    tenant_id: tenantId,
    external_id: lead.id,
    first_name: lead.first_name ?? null,
    last_name: lead.last_name ?? null,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    address_street: lead.address?.street ?? null,
    address_zip: lead.address?.zip ?? null,
    address_city: lead.address?.city ?? null,
    address_canton: lead.address?.canton ?? null,
    status: mapLeadStatus(lead.status),
    source: mapLeadSource(lead.source),
    setter_id: setterId,
    created_at: lead.created_at,
    updated_at: lead.updated_at,
  }
}

export function normaliseOffer(
  offer: ReonicOffer,
  tenantId: string,
  memberMap: Map<string, string>,
  leadMap: Map<string, string>,
): Record<string, unknown> {
  const beraterId = offer.berater_id ? memberMap.get(offer.berater_id) ?? null : null
  const leadId = offer.lead_id ? leadMap.get(offer.lead_id) ?? null : null

  return {
    tenant_id: tenantId,
    external_id: offer.id,
    lead_id: leadId,
    berater_id: beraterId,
    title: offer.title,
    description: offer.reference_nr ? `Ref: ${offer.reference_nr}` : null,
    amount_chf: offer.value ?? 0,
    status: mapOfferStatus(offer.status),
    created_at: offer.created_at,
    updated_at: offer.updated_at,
  }
}
