import { z } from 'zod'

// ---------------------------------------------------------------------------
// Reonic API Response Schemas
// ---------------------------------------------------------------------------

export const ReonicUserSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    email: z.string().email(),
    first_name: z.string(),
    last_name: z.string(),
    role: z.string(),
    active: z.boolean(),
  })
  .passthrough()

export type ReonicUser = z.infer<typeof ReonicUserSchema>

export const ReonicAddressSchema = z
  .object({
    street: z.string().nullish(),
    zip: z.string().nullish(),
    city: z.string().nullish(),
    canton: z.string().nullish(),
    country: z.string().nullish(),
  })
  .passthrough()

export type ReonicAddress = z.infer<typeof ReonicAddressSchema>

export const ReonicLeadSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    created_at: z.string(),
    updated_at: z.string(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
    address: ReonicAddressSchema.nullish(),
    status: z.string(),
    source: z.string().nullish(),
    assigned_to: z.union([z.string(), z.number()]).transform(String).nullish(),
  })
  .passthrough()

export type ReonicLead = z.infer<typeof ReonicLeadSchema>

export const ReonicOfferSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    created_at: z.string(),
    updated_at: z.string(),
    reference_nr: z.string().nullish(),
    title: z.string(),
    status: z.string(),
    value: z.number().nullish(),
    lead_id: z.union([z.string(), z.number()]).transform(String).nullish(),
    setter_id: z.union([z.string(), z.number()]).transform(String).nullish(),
    berater_id: z.union([z.string(), z.number()]).transform(String).nullish(),
    pipeline_stage: z.string().nullish(),
  })
  .passthrough()

export type ReonicOffer = z.infer<typeof ReonicOfferSchema>
