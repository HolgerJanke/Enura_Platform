import { createClient } from '@supabase/supabase-js'
import type { CalendarEventInsert } from '@enura/types'
import type { ConnectorBase, ConnectorConfig, SyncResult, SyncError } from '../base.js'
import { ConnectorValidationError } from '../base.js'
import { upsertRecords } from '../upsert.js'
import {
  GoogleCalendarCredentialsSchema,
  GoogleCalendarConfigSchema,
  type GoogleCalendarCredentials,
  type GoogleCalendarConfig,
  type GoogleCalendarEvent,
} from './schemas.js'
import { classifyEvent } from './classify.js'
import { fetchAllEvents, validateCredentials } from './client.js'

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Parse and validate Google Calendar credentials and config from connector row.
 */
function parseConnectorSettings(connector: ConnectorConfig): {
  credentials: GoogleCalendarCredentials
  config: GoogleCalendarConfig
} {
  const credResult = GoogleCalendarCredentialsSchema.safeParse(connector.credentials)
  if (!credResult.success) {
    throw new ConnectorValidationError(
      'credentials',
      `Invalid Google Calendar credentials: ${credResult.error.message}`,
    )
  }

  const configResult = GoogleCalendarConfigSchema.safeParse(connector.config)
  if (!configResult.success) {
    throw new ConnectorValidationError(
      'config',
      `Invalid Google Calendar config: ${configResult.error.message}`,
    )
  }

  return { credentials: credResult.data, config: configResult.data }
}

/**
 * Look up the team_member_id for a given email within a tenant.
 * Returns null if no matching team member is found.
 */
async function resolveTeamMemberId(
  companyId: string,
  email: string,
): Promise<string | null> {
  const db = getServiceClient()
  const { data } = await db
    .from('team_members')
    .select('id')
    .eq('company_id', companyId)
    .eq('email', email)
    .eq('is_active', true)
    .single()

  return data?.id ?? null
}

/**
 * Resolve the start/end timestamps from a Google Calendar event.
 * Handles both dateTime (timed events) and date (all-day events).
 */
function resolveEventTimes(event: GoogleCalendarEvent): {
  startsAt: string
  endsAt: string
  allDay: boolean
} {
  const startDateTime = event.start.dateTime
  const startDate = event.start.date
  const endDateTime = event.end.dateTime
  const endDate = event.end.date

  if (startDateTime && endDateTime) {
    return {
      startsAt: startDateTime,
      endsAt: endDateTime,
      allDay: false,
    }
  }

  // All-day events use date strings (YYYY-MM-DD)
  return {
    startsAt: startDate ? `${startDate}T00:00:00Z` : new Date().toISOString(),
    endsAt: endDate ? `${endDate}T00:00:00Z` : new Date().toISOString(),
    allDay: true,
  }
}

/**
 * Transform a Google Calendar event into the calendar_events table shape.
 */
function normaliseEvent(
  companyId: string,
  teamMemberId: string | null,
  event: GoogleCalendarEvent,
): CalendarEventInsert {
  const { startsAt, endsAt, allDay } = resolveEventTimes(event)
  const eventType = classifyEvent(event.summary)

  return {
    company_id: companyId,
    external_id: event.id,
    team_member_id: teamMemberId,
    title: event.summary ?? '(No title)',
    description: event.description ?? null,
    location: event.location ?? null,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: allDay,
    event_type: eventType,
  }
}

export const googleCalendarConnector: ConnectorBase = {
  type: 'google_calendar',
  label: 'Google Calendar',
  version: '1.0.0',

  async validate(connector: ConnectorConfig): Promise<void> {
    const { credentials, config } = parseConnectorSettings(connector)
    await validateCredentials(credentials)

    if (config.calendar_ids.length === 0) {
      throw new ConnectorValidationError('config', 'At least one calendar ID (email) is required')
    }
  },

  async sync(companyId: string, connector: ConnectorConfig): Promise<SyncResult> {
    const startTime = Date.now()
    const errors: SyncError[] = []
    let recordsFetched = 0
    let recordsWritten = 0
    let recordsSkipped = 0

    try {
      const { credentials, config } = parseConnectorSettings(connector)

      // Time window: 7 days ago to 90 days in the future
      const now = new Date()
      const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()

      const allNormalised: CalendarEventInsert[] = []

      for (const calendarId of config.calendar_ids) {
        try {
          // Resolve team member for this calendar email
          const teamMemberId = await resolveTeamMemberId(companyId, calendarId)

          const events = await fetchAllEvents(credentials, calendarId, timeMin, timeMax)
          recordsFetched += events.length

          // Skip cancelled events
          const activeEvents = events.filter((e) => e.status !== 'cancelled')
          recordsSkipped += events.length - activeEvents.length

          const normalised = activeEvents.map((event) =>
            normaliseEvent(companyId, teamMemberId, event),
          )

          allNormalised.push(...normalised)
        } catch (err) {
          errors.push({
            code: 'GCAL_FETCH_EVENTS',
            message: err instanceof Error ? err.message : String(err),
            context: { calendarId },
          })
        }
      }

      if (allNormalised.length > 0) {
        const result = await upsertRecords(
          'calendar_events',
          allNormalised as unknown as Record<string, unknown>[],
          ['company_id', 'external_id'],
        )

        recordsWritten += result.written
        errors.push(...result.errors)
      }
    } catch (err) {
      errors.push({
        code: 'GCAL_SYNC_FATAL',
        message: err instanceof Error ? err.message : String(err),
        context: {},
      })
    }

    return {
      success: errors.length === 0,
      recordsFetched,
      recordsWritten,
      recordsSkipped,
      errors,
      durationMs: Date.now() - startTime,
    }
  },
}
