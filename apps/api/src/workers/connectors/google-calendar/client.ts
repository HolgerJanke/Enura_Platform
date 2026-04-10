import { google } from 'googleapis'
import { ConnectorAuthError } from '../base.js'
import {
  GoogleCalendarEventSchema,
  type GoogleCalendarEvent,
  type GoogleCalendarCredentials,
} from './schemas.js'

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

/**
 * Build a JWT-authenticated Google API client from a service account key.
 */
function buildAuthClient(credentials: GoogleCalendarCredentials) {
  return new google.auth.JWT({
    email: credentials.service_account_email,
    key: credentials.private_key,
    scopes: SCOPES,
  })
}

/**
 * Validate that the service account credentials can authenticate successfully.
 */
export async function validateCredentials(credentials: GoogleCalendarCredentials): Promise<void> {
  const auth = buildAuthClient(credentials)
  try {
    await auth.authorize()
  } catch (err) {
    throw new ConnectorAuthError(
      `Google Calendar auth failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export interface FetchEventsOptions {
  calendarId: string
  timeMin: string
  timeMax: string
  pageToken?: string
}

export interface FetchEventsResult {
  events: GoogleCalendarEvent[]
  nextPageToken: string | null
}

/**
 * Fetch calendar events for a single calendar ID within a time range.
 * Handles pagination via pageToken.
 */
async function fetchEventsPage(
  credentials: GoogleCalendarCredentials,
  opts: FetchEventsOptions,
): Promise<FetchEventsResult> {
  const auth = buildAuthClient(credentials)
  const calendar = google.calendar({ version: 'v3', auth })

  const listParams: Record<string, unknown> = {
    calendarId: opts.calendarId,
    timeMin: opts.timeMin,
    timeMax: opts.timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  }
  if (opts.pageToken) {
    listParams['pageToken'] = opts.pageToken
  }

  const response = (await calendar.events.list(listParams as unknown as Parameters<typeof calendar.events.list>[0])) as unknown as { data: { items?: unknown[]; nextPageToken?: string | null } }

  const rawItems = response.data.items ?? []
  const events: GoogleCalendarEvent[] = []

  for (const item of rawItems) {
    const parsed = GoogleCalendarEventSchema.safeParse(item)
    if (parsed.success) {
      events.push(parsed.data)
    }
    // Skip events that don't match schema (e.g., missing id)
  }

  return {
    events,
    nextPageToken: (response.data.nextPageToken as string) ?? null,
  }
}

/**
 * Fetch all events for a calendar within a time range, handling pagination automatically.
 */
export async function fetchAllEvents(
  credentials: GoogleCalendarCredentials,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarEvent[]> {
  const allEvents: GoogleCalendarEvent[] = []
  let pageToken: string | undefined

  do {
    const fetchOpts: FetchEventsOptions = {
      calendarId,
      timeMin,
      timeMax,
    }
    if (pageToken) {
      fetchOpts.pageToken = pageToken
    }
    const result = await fetchEventsPage(credentials, fetchOpts)

    allEvents.push(...result.events)
    pageToken = result.nextPageToken ?? undefined
  } while (pageToken)

  return allEvents
}
