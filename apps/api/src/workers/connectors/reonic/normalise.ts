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
  // Reonic v2 h360/offers uses `state` with these values:
  open: 'draft',
  closed: 'won',
  request: 'draft',
  offer: 'sent',
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

function mapLeadStatus(raw: string | null | undefined): string {
  if (!raw) return 'new'
  return LEAD_STATUS_MAP[raw.toLowerCase()] ?? 'new'
}

function mapLeadSource(raw: string | null | undefined): string {
  if (!raw) return 'other'
  return LEAD_SOURCE_MAP[raw.toLowerCase()] ?? 'other'
}

function mapOfferStatus(raw: string | null | undefined): string {
  if (!raw) return 'draft'
  return OFFER_STATUS_MAP[raw.toLowerCase()] ?? 'draft'
}

function mapRoleType(raw: string | null | undefined): string {
  if (!raw) return 'other'
  return ROLE_TYPE_MAP[raw.toLowerCase()] ?? raw.toLowerCase()
}

// ---------------------------------------------------------------------------
// Normalise functions
// Each function accepts the (possibly camelCase, possibly snake_case) API
// record and produces a flat DB-ready object.
// ---------------------------------------------------------------------------

export function normaliseUser(
  user: ReonicUser,
  companyId: string,
): Record<string, unknown> {
  // Support both camelCase (v2 real) and snake_case (legacy)
  const firstName = user.firstName ?? user.first_name ?? null
  const lastName  = user.lastName  ?? user.last_name  ?? null
  // role can be a string or the first element of a roles array
  const roleRaw = (Array.isArray(user.roles) && user.roles.length > 0)
    ? user.roles[0]
    : user.role
  const isActive = user.isActive ?? user.active ?? true

  return {
    company_id:  companyId,
    external_id: user.id,
    first_name:  firstName,
    last_name:   lastName,
    email:       user.email ?? null,
    role_type:   mapRoleType(roleRaw ?? undefined),
    is_active:   isActive,
    updated_at:  new Date().toISOString(),
  }
}

export function normaliseLead(
  lead: ReonicLead,
  companyId: string,
  memberMap: Map<string, string>,
): Record<string, unknown> {
  // Support both camelCase and snake_case timestamps (fallback to now)
  const now = new Date().toISOString()
  const createdAt = lead.createdAt ?? lead.created_at ?? now
  const updatedAt = lead.updatedAt ?? lead.updated_at ?? now

  // Support both camelCase and snake_case name fields
  const firstName = lead.firstName ?? lead.first_name ?? null
  const lastName  = lead.lastName  ?? lead.last_name  ?? null

  // Phone: telephone (v2 real) or phone or phoneNumber (legacy)
  const phone = lead.telephone ?? lead.mobilePhone ?? lead.phone ?? lead.phoneNumber ?? null

  // Address: flat fields in v2 (no nested object)
  const streetNumber = lead.number ?? lead.streetNumber ?? lead.houseNumber ?? null
  const street = lead.street
    ? (streetNumber ? `${lead.street} ${streetNumber}` : lead.street)
    : null
  const zip  = lead.postcode ?? lead.zip ?? null

  // Assignment: assignedUserId (v2) or assigned_to (legacy)
  const assignedExtId = lead.assignedUserId ?? lead.assigned_to ?? null
  const setterId = assignedExtId ? (memberMap.get(assignedExtId) ?? null) : null

  return {
    company_id:    companyId,
    external_id:   lead.id,
    first_name:    firstName,
    last_name:     lastName,
    email:         lead.email ?? null,
    phone,
    address_street: street,
    address_zip:    zip,
    address_city:   lead.city ?? null,
    address_canton: lead.canton ?? null,
    status:         mapLeadStatus(lead.status),
    source:         mapLeadSource(lead.source),
    setter_id:      setterId,
    created_at:     createdAt,
    updated_at:     updatedAt,
  }
}

export function normaliseOffer(
  offer: ReonicOffer,
  companyId: string,
  memberMap: Map<string, string>,
  leadMap: Map<string, string>,
): Record<string, unknown> {
  const now = new Date().toISOString()
  // v2 API: requestCreatedAt / offerLastEditedAt (fallback to generic createdAt)
  const createdAt = offer.requestCreatedAt ?? offer.createdAt ?? offer.created_at ?? now
  const updatedAt = offer.offerLastEditedAt ?? offer.updatedAt ?? offer.updated_at ?? now

  // Reference number: referenceNr (v2) or reference_nr (legacy)
  const refNr = offer.referenceNr ?? offer.reference_nr ?? null

  // Title or name
  const title = offer.title ?? offer.name ?? (refNr ? `Angebot ${refNr}` : 'Angebot')

  // Monetary value: customDealValue > totalPlannedPrice > value > totalPrice
  const amount = offer.customDealValue ?? offer.totalPlannedPrice ?? offer.value ?? offer.totalPrice ?? 0

  // Consultant: assignedToId (v2 real) or assignedUserId or berater_id (legacy)
  const beraterExtId = offer.assignedToId ?? offer.assignedUserId ?? offer.berater_id ?? null
  const beraterId = beraterExtId ? (memberMap.get(beraterExtId) ?? null) : null

  // Linked contact: customer.id (v2 real) or contactId or lead_id (legacy)
  const contactExtId = offer.customer?.id ?? offer.contactId ?? offer.lead_id ?? null
  const leadId = contactExtId ? (leadMap.get(contactExtId) ?? null) : null

  // Status: v2 uses `state` field (Open, Won, Lost), fallback to `status`
  const statusRaw = offer.state ?? offer.status

  return {
    company_id:     companyId,
    external_id:    offer.id,
    lead_id:        leadId,
    berater_id:     beraterId,
    title,
    description:    refNr ? `Ref: ${refNr}` : null,
    amount_chf:     amount,
    status:         mapOfferStatus(statusRaw),
    created_at:     createdAt,
    updated_at:     updatedAt,
  }
}
