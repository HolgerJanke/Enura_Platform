import { z } from 'zod'

// ---------------------------------------------------------------------------
// Leadnotes API Response Schema
// ---------------------------------------------------------------------------

export const LeadnotesLeadSchema = z
  .object({
    id: z.number(),
    lead_type_id: z.number().nullable().optional(),
    status: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    birth_date: z.string().nullable().optional(),
    street_no: z.string().nullable().optional(),
    zip_code: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    custom_data: z.record(z.unknown()).nullable().optional(),
    commission: z.number().nullable().optional(),
    price: z.number().nullable().optional(),
    created_at: z.string(),
  })
  .passthrough()

export type LeadnotesLead = z.infer<typeof LeadnotesLeadSchema>

// ---------------------------------------------------------------------------
// Leadnotes Credentials Schema (stored in connector.credentials)
//
// The frontend form sends camelCase keys (apiKey / baseUrl).
// We use z.preprocess to normalise both naming conventions so that
// credentials saved by either the old snake_case or new camelCase form work.
// ---------------------------------------------------------------------------

export const LeadnotesCredentialsSchema = z.preprocess(
  (raw) => {
    const r = raw as Record<string, unknown>
    return {
      api_key:  r['api_key']  ?? r['apiKey']  ?? '',
      base_url: r['base_url'] ?? r['baseUrl'] ?? 'https://leads.alpen-energie.ch',
    }
  },
  z.object({
    api_key:  z.string().min(1, 'API Key ist erforderlich'),
    base_url: z.string().url().default('https://leads.alpen-energie.ch'),
  }),
)

export type LeadnotesCredentials = z.infer<typeof LeadnotesCredentialsSchema>
