import { z } from 'zod'

// ---------------------------------------------------------------------------
// Google Calendar API Response Schema
// ---------------------------------------------------------------------------

export const GoogleCalendarDateTimeSchema = z.object({
  dateTime: z.string().optional(),
  date: z.string().optional(),
  timeZone: z.string().optional(),
})

export const GoogleCalendarEventSchema = z
  .object({
    id: z.string(),
    summary: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    status: z.enum(['confirmed', 'tentative', 'cancelled']).default('confirmed'),
    start: GoogleCalendarDateTimeSchema,
    end: GoogleCalendarDateTimeSchema,
  })
  .passthrough()

export type GoogleCalendarEvent = z.infer<typeof GoogleCalendarEventSchema>

// ---------------------------------------------------------------------------
// Google Calendar Credentials Schema (stored in connector.credentials)
// ---------------------------------------------------------------------------

export const GoogleCalendarCredentialsSchema = z.object({
  service_account_email: z.string().email(),
  private_key: z.string().min(1),
})

export type GoogleCalendarCredentials = z.infer<typeof GoogleCalendarCredentialsSchema>

// ---------------------------------------------------------------------------
// Google Calendar Config Schema (stored in connector.config)
// ---------------------------------------------------------------------------

export const GoogleCalendarConfigSchema = z.object({
  calendar_ids: z.array(z.string().email()).min(1),
})

export type GoogleCalendarConfig = z.infer<typeof GoogleCalendarConfigSchema>
