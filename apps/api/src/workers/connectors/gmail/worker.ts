import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import type {
  ConnectorBase,
  ConnectorConfig,
  SyncResult,
  SyncError,
} from '../base.js'
import { ConnectorValidationError, ConnectorAuthError } from '../base.js'

// ---------------------------------------------------------------------------
// Gmail Connector
//
// Counts sent emails per team member per day. Stores daily aggregates
// in the email_activity table. Does NOT store email content, subjects,
// recipients, or any PII. Only counts.
//
// Uses a Google Workspace service account with domain-wide delegation
// to impersonate each team member and count their sent messages.
// ---------------------------------------------------------------------------

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

interface GmailCredentials {
  service_account_email: string
  private_key: string
}

interface GmailConfig {
  /** List of team member emails to track sent email counts for */
  tracked_emails: string[]
  /** Number of days back to sync (default: 7) */
  lookback_days?: number
}

/**
 * Build a JWT-authenticated Google API client that impersonates
 * a specific user via domain-wide delegation.
 */
function buildAuthClient(
  credentials: GmailCredentials,
  impersonateEmail: string,
) {
  return new google.auth.JWT({
    email: credentials.service_account_email,
    key: credentials.private_key,
    scopes: GMAIL_SCOPES,
    subject: impersonateEmail,
  })
}

/**
 * Parse and validate Gmail connector credentials.
 */
function parseCredentials(
  raw: Record<string, unknown>,
): GmailCredentials {
  const email = raw['service_account_email']
  const key = raw['private_key']

  if (typeof email !== 'string' || email.length === 0) {
    throw new ConnectorValidationError(
      'service_account_email',
      'Service Account E-Mail ist erforderlich',
    )
  }
  if (typeof key !== 'string' || key.length === 0) {
    throw new ConnectorValidationError(
      'private_key',
      'Private Key ist erforderlich',
    )
  }

  return { service_account_email: email, private_key: key }
}

/**
 * Parse and validate Gmail connector config.
 */
function parseConfig(raw: Record<string, unknown>): GmailConfig {
  const trackedEmails = raw['tracked_emails']
  if (!Array.isArray(trackedEmails) || trackedEmails.length === 0) {
    throw new ConnectorValidationError(
      'tracked_emails',
      'Mindestens eine E-Mail-Adresse ist erforderlich',
    )
  }

  const lookbackDays = typeof raw['lookback_days'] === 'number'
    ? raw['lookback_days']
    : 7

  return {
    tracked_emails: trackedEmails as string[],
    lookback_days: lookbackDays,
  }
}

/**
 * Count emails in the SENT label for a given user within a date range.
 * Uses Gmail API's messages.list with a query filter.
 */
async function countSentEmails(
  credentials: GmailCredentials,
  userEmail: string,
  afterDate: string,
  beforeDate: string,
): Promise<number> {
  const auth = buildAuthClient(credentials, userEmail)
  const gmail = google.gmail({ version: 'v1', auth })

  // Gmail query: sent after date X and before date Y
  const query = `in:sent after:${afterDate} before:${beforeDate}`

  let totalMessages = 0
  let pageToken: string | undefined

  do {
    const listParams: {
      userId: string
      q: string
      maxResults: number
      pageToken?: string
    } = {
      userId: 'me',
      q: query,
      maxResults: 500,
    }

    if (pageToken) {
      listParams.pageToken = pageToken
    }

    const response = await gmail.users.messages.list(listParams)

    const resultSizeEstimate = response.data.resultSizeEstimate ?? 0
    const messages = response.data.messages ?? []

    // If there are messages in this page, add them to the count
    totalMessages += messages.length

    // If the API tells us there are no more results and the list is empty
    if (resultSizeEstimate === 0 && messages.length === 0) {
      break
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return totalMessages
}

/**
 * Resolve the team_member_id for a given email within a tenant.
 */
async function resolveTeamMemberId(
  tenantId: string,
  email: string,
): Promise<string | null> {
  const db = getServiceClient()
  const { data } = await db
    .from('team_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .eq('is_active', true)
    .single()

  return data?.id ?? null
}

/**
 * Format a Date as YYYY/MM/DD for Gmail query syntax.
 */
function formatGmailDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}

/**
 * Format a Date as YYYY-MM-DD for the email_activity.activity_date column.
 */
function formatActivityDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export class GmailConnector implements ConnectorBase {
  readonly type = 'gmail'
  readonly label = 'Gmail'
  readonly version = '1.0.0'

  async validate(connector: ConnectorConfig): Promise<void> {
    const credentials = parseCredentials(connector.credentials)
    const config = parseConfig(connector.config)

    // Test auth by attempting to impersonate the first tracked email
    const firstEmail = config.tracked_emails[0]
    if (!firstEmail) {
      throw new ConnectorValidationError(
        'tracked_emails',
        'Mindestens eine E-Mail-Adresse ist erforderlich',
      )
    }

    const auth = buildAuthClient(credentials, firstEmail)
    try {
      await auth.authorize()
    } catch (err) {
      throw new ConnectorAuthError(
        `Gmail auth failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  async sync(
    tenantId: string,
    connector: ConnectorConfig,
  ): Promise<SyncResult> {
    const startTime = Date.now()
    const errors: SyncError[] = []
    let recordsFetched = 0
    let recordsWritten = 0
    let recordsSkipped = 0

    try {
      const credentials = parseCredentials(connector.credentials)
      const config = parseConfig(connector.config)
      const db = getServiceClient()

      const lookbackDays = config.lookback_days ?? 7
      const now = new Date()

      // Generate array of dates to sync (lookbackDays ago to yesterday)
      const datesToSync: Date[] = []
      for (let i = lookbackDays; i >= 1; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)
        datesToSync.push(date)
      }

      for (const email of config.tracked_emails) {
        // Resolve the team_member_id for this email
        const teamMemberId = await resolveTeamMemberId(tenantId, email)
        if (!teamMemberId) {
          errors.push({
            code: 'GMAIL_MEMBER_NOT_FOUND',
            message: `No active team member found for email: ${email}`,
            context: { email, tenantId },
          })
          recordsSkipped++
          continue
        }

        for (const date of datesToSync) {
          try {
            // Date range: from start of day to start of next day
            const nextDay = new Date(date)
            nextDay.setDate(nextDay.getDate() + 1)

            const afterDate = formatGmailDate(date)
            const beforeDate = formatGmailDate(nextDay)

            const emailsSent = await countSentEmails(
              credentials,
              email,
              afterDate,
              beforeDate,
            )
            recordsFetched++

            const activityDate = formatActivityDate(date)

            // Upsert the daily aggregate
            const { error: upsertError } = await db
              .from('email_activity')
              .upsert(
                {
                  tenant_id: tenantId,
                  team_member_id: teamMemberId,
                  activity_date: activityDate,
                  emails_sent: emailsSent,
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: 'tenant_id,team_member_id,activity_date',
                  ignoreDuplicates: false,
                },
              )

            if (upsertError) {
              errors.push({
                code: 'GMAIL_UPSERT',
                message: upsertError.message,
                context: { email, activityDate },
              })
            } else {
              recordsWritten++
            }
          } catch (err) {
            errors.push({
              code: 'GMAIL_COUNT_EMAILS',
              message: err instanceof Error ? err.message : String(err),
              context: { email, date: formatActivityDate(date) },
            })
          }
        }
      }
    } catch (err) {
      errors.push({
        code: 'GMAIL_SYNC_FATAL',
        message: err instanceof Error ? err.message : String(err),
        context: { tenantId },
      })
    }

    return {
      success: errors.filter((e) => e.code === 'GMAIL_SYNC_FATAL').length === 0,
      recordsFetched,
      recordsWritten,
      recordsSkipped,
      errors,
      durationMs: Date.now() - startTime,
    }
  }
}
