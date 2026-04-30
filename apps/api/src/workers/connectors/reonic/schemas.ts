import { z } from 'zod'

// ---------------------------------------------------------------------------
// Reonic REST API v2 — Response Schemas
//
// The live API returns camelCase field names (firstName, lastName, createdAt…).
// We keep snake_case variants as optional fallbacks so the schemas survive any
// future API change without hard failures. All non-id fields are .nullish() so
// a missing field produces null rather than a validation error.
// ---------------------------------------------------------------------------

export const ReonicUserSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    // camelCase — real Reonic v2
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    // snake_case — legacy / fallback
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    email: z.string().nullish(),
    // role as single string or array of strings
    role: z.string().nullish(),
    roles: z.array(z.string()).nullish(),
    // active flag — API v2 may not include it
    active: z.boolean().nullish(),
    isActive: z.boolean().nullish(),
  })
  .passthrough()

export type ReonicUser = z.infer<typeof ReonicUserSchema>

// ---------------------------------------------------------------------------
// Contacts (GET /clients/{clientId}/contacts)
// The API returns flat address fields (street, streetNumber/houseNumber, city,
// postcode/zip) NOT a nested address object. All optional.
// ---------------------------------------------------------------------------

export const ReonicLeadSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    // timestamps — camelCase in v2
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
    // name
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    // contact details
    email: z.string().nullish(),
    phone: z.string().nullish(),
    phoneNumber: z.string().nullish(),
    telephone: z.string().nullish(),     // v2 real field name
    mobilePhone: z.string().nullish(),   // v2 alternate
    // flat address fields (v2 does NOT nest them in an object)
    street: z.string().nullish(),
    streetNumber: z.string().nullish(),
    houseNumber: z.string().nullish(),   // alternate key
    number: z.string().nullish(),        // v2 real field name
    city: z.string().nullish(),
    postcode: z.string().nullish(),
    zip: z.string().nullish(),           // alternate key
    country: z.string().nullish(),
    canton: z.string().nullish(),
    // assignment
    assignedUserId: z.union([z.string(), z.number()]).transform(String).nullish(),
    assigned_to: z.union([z.string(), z.number()]).transform(String).nullish(),
    // status / source — may or may not be present
    status: z.string().nullish(),
    source: z.string().nullish(),
  })
  .passthrough()

export type ReonicLead = z.infer<typeof ReonicLeadSchema>

// ---------------------------------------------------------------------------
// H360 Offers (GET /clients/{clientId}/h360/offers)
// Response envelope is { "results": [...] } — handled in unwrapPaged.
// ---------------------------------------------------------------------------

export const ReonicOfferSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    // timestamps — v2 API uses requestCreatedAt / offerLastEditedAt
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
    requestCreatedAt: z.string().nullish(),
    offerLastEditedAt: z.string().nullish(),
    // reference / title
    referenceNr: z.string().nullish(),
    reference_nr: z.string().nullish(),
    title: z.string().nullish(),
    name: z.string().nullish(),         // alternate key (v2: contact name)
    // status — v2 API uses `state` (Open/Won/Lost etc.)
    status: z.string().nullish(),
    state: z.string().nullish(),
    type: z.string().nullish(),         // request / offer
    // monetary value — v2: totalPlannedPrice, customDealValue
    value: z.number().nullish(),
    totalPrice: z.number().nullish(),
    totalPlannedPrice: z.number().nullish(),
    customDealValue: z.number().nullish(),
    // linked contact — v2: nested customer object { id: string }
    contactId: z.union([z.string(), z.number()]).transform(String).nullish(),
    lead_id: z.union([z.string(), z.number()]).transform(String).nullish(),
    customer: z.object({ id: z.string() }).nullish(),
    // assigned consultants — v2: assignedToId
    assignedUserId: z.union([z.string(), z.number()]).transform(String).nullish(),
    assignedToId: z.union([z.string(), z.number()]).transform(String).nullish(),
    berater_id: z.union([z.string(), z.number()]).transform(String).nullish(),
    setter_id: z.union([z.string(), z.number()]).transform(String).nullish(),
    // pipeline
    pipelineStage: z.string().nullish(),
    pipeline_stage: z.string().nullish(),
    // lead source
    leadSource: z.string().nullish(),
  })
  .passthrough()

export type ReonicOffer = z.infer<typeof ReonicOfferSchema>
