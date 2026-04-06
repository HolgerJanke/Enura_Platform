import { z } from 'zod'

// ---------------------------------------------------------------------------
// Leadnotes API Response Schema
// ---------------------------------------------------------------------------

export const LeadnotesLeadSchema = z
  .object({
    id: z.string(),
    created_at: z.string(),
    source: z.string(),
    source_detail: z.string().nullable().optional(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    message: z.string().nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough()

export type LeadnotesLead = z.infer<typeof LeadnotesLeadSchema>

// ---------------------------------------------------------------------------
// Leadnotes Credentials Schema (stored in connector.credentials)
// ---------------------------------------------------------------------------

export const LeadnotesCredentialsSchema = z.object({
  api_key: z.string().min(1),
  base_url: z.string().url().default('https://api.leadnotes.io'),
})

export type LeadnotesCredentials = z.infer<typeof LeadnotesCredentialsSchema>
