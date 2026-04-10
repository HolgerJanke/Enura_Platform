import { createClient } from '@supabase/supabase-js'
import type {
  ConnectorBase,
  ConnectorConfig,
  SyncResult,
  SyncError,
} from '../base.js'
import { ConnectorValidationError } from '../base.js'
import { upsertRecords } from '../upsert.js'
import {
  WhatsAppMessageSchema,
  type WhatsAppWebhook,
  type WhatsAppIncomingMessage,
  type WhatsAppMessage,
  type WhatsAppMetadata,
} from './schemas.js'
import { WhatsAppCloudApiClient } from './client.js'

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Normalise a phone number to E.164-like format for matching.
 * Strips leading '+' and non-digit characters.
 */
function normalisePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

/**
 * Look up a lead by phone number within a tenant.
 * Tries exact match first, then falls back to normalised suffix matching.
 */
async function resolveLeadByPhone(
  companyId: string,
  phone: string,
): Promise<string | null> {
  const db = getServiceClient()
  const normalised = normalisePhone(phone)

  // Try exact match on normalised phone
  const { data: exactMatch } = await db
    .from('leads')
    .select('id, phone')
    .eq('company_id', companyId)
    .not('phone', 'is', null)

  if (!exactMatch || exactMatch.length === 0) return null

  for (const lead of exactMatch) {
    const leadEntry = lead as { id: string; phone: string | null }
    if (!leadEntry.phone) continue
    const leadNormalised = normalisePhone(leadEntry.phone)
    // Match if normalised numbers end with the same digits (last 10 digits)
    if (
      leadNormalised === normalised ||
      leadNormalised.endsWith(normalised.slice(-10)) ||
      normalised.endsWith(leadNormalised.slice(-10))
    ) {
      return leadEntry.id
    }
  }

  return null
}

/**
 * Look up a team member by phone number within a tenant.
 */
async function resolveTeamMemberByPhone(
  companyId: string,
  phone: string,
): Promise<string | null> {
  const db = getServiceClient()
  const normalised = normalisePhone(phone)

  const { data: members } = await db
    .from('team_members')
    .select('id, phone')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .not('phone', 'is', null)

  if (!members || members.length === 0) return null

  for (const member of members) {
    const m = member as { id: string; phone: string | null }
    if (!m.phone) continue
    const memberNormalised = normalisePhone(m.phone)
    if (
      memberNormalised === normalised ||
      memberNormalised.endsWith(normalised.slice(-10)) ||
      normalised.endsWith(memberNormalised.slice(-10))
    ) {
      return m.id
    }
  }

  return null
}

/**
 * Resolve the tenant that owns a given WhatsApp phone number ID.
 * Looks up in the connectors table for a whatsapp connector that has
 * the matching phone_number_id in its credentials.
 */
export async function resolveTenantByPhoneNumberId(
  phoneNumberId: string,
): Promise<{ companyId: string; connectorId: string } | null> {
  const db = getServiceClient()

  const { data: connectors } = await db
    .from('connectors')
    .select('id, company_id, credentials')
    .eq('type', 'whatsapp')
    .eq('status', 'active')

  if (!connectors || connectors.length === 0) return null

  for (const connector of connectors) {
    const c = connector as {
      id: string
      company_id: string
      credentials: Record<string, unknown>
    }
    if (c.credentials['phone_number_id'] === phoneNumberId) {
      return { companyId: c.company_id, connectorId: c.id }
    }
  }

  return null
}

/**
 * Process a validated WhatsApp webhook payload.
 * Called asynchronously after the webhook endpoint returns 200.
 */
export async function processWebhook(payload: WhatsAppWebhook): Promise<{
  processed: number
  errors: SyncError[]
}> {
  let processed = 0
  const errors: SyncError[] = []

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue

      const metadata: WhatsAppMetadata = change.value.metadata
      const messages = change.value.messages ?? []

      // Resolve tenant from the phone_number_id in metadata
      const tenantInfo = await resolveTenantByPhoneNumberId(
        metadata.phone_number_id,
      )

      if (!tenantInfo) {
        errors.push({
          code: 'WA_TENANT_NOT_FOUND',
          message: `No active WhatsApp connector found for phone_number_id: ${metadata.phone_number_id}`,
          context: { phoneNumberId: metadata.phone_number_id },
        })
        continue
      }

      const { companyId } = tenantInfo

      for (const msg of messages) {
        try {
          const normalised = await normaliseIncomingMessage(
            companyId,
            msg,
            metadata,
          )

          const validationResult = WhatsAppMessageSchema.safeParse(normalised)
          if (!validationResult.success) {
            errors.push({
              code: 'WA_VALIDATION',
              message: `Message validation failed: ${validationResult.error.message}`,
              context: { messageId: msg.id },
            })
            continue
          }

          const result = await upsertRecords(
            'whatsapp_messages',
            [validationResult.data as unknown as Record<string, unknown>],
            ['company_id', 'external_id'],
          )

          if (result.errors.length > 0) {
            errors.push(...result.errors)
          } else {
            processed += result.written
          }
        } catch (err) {
          errors.push({
            code: 'WA_PROCESS_MESSAGE',
            message: err instanceof Error ? err.message : String(err),
            context: { messageId: msg.id, companyId },
          })
        }
      }
    }
  }

  return { processed, errors }
}

/**
 * Normalise an incoming WhatsApp message into our internal schema.
 */
async function normaliseIncomingMessage(
  companyId: string,
  msg: WhatsAppIncomingMessage,
  metadata: WhatsAppMetadata,
): Promise<WhatsAppMessage> {
  // For inbound messages, the sender (msg.from) is the customer,
  // and the business number (metadata.display_phone_number) is our side.
  const customerPhone = msg.from

  // Try to match the customer phone to a lead
  const leadId = await resolveLeadByPhone(companyId, customerPhone)

  // Try to resolve the team member associated with this business phone number
  const teamMemberId = await resolveTeamMemberByPhone(
    companyId,
    metadata.display_phone_number,
  )

  // Extract message body (text messages have body in text.body)
  const body = msg.text?.body ?? null

  // Convert Unix timestamp to ISO string
  const sentAt = new Date(parseInt(msg.timestamp, 10) * 1000).toISOString()

  return {
    company_id: companyId,
    external_id: msg.id,
    wa_id: customerPhone,
    direction: 'inbound',
    message_type: msg.type,
    body,
    team_member_id: teamMemberId,
    lead_id: leadId,
    sent_at: sentAt,
  }
}

// ---------------------------------------------------------------------------
// WhatsApp Connector (implements ConnectorBase)
//
// sync() is a no-op because WhatsApp data flows through webhooks,
// not polling. The connector entry in the DB still serves to:
//   - Store credentials (access_token, phone_number_id, verify_token)
//   - Indicate the connector is active/configured
//   - Surface status in the admin UI
// ---------------------------------------------------------------------------

export class WhatsAppConnector implements ConnectorBase {
  readonly type = 'whatsapp'
  readonly label = 'WhatsApp Business'
  readonly version = '1.0.0'

  async validate(connector: ConnectorConfig): Promise<void> {
    const creds = connector.credentials as Record<string, string>

    if (!creds['access_token']) {
      throw new ConnectorValidationError(
        'access_token',
        'WhatsApp Cloud API Access Token ist erforderlich',
      )
    }
    if (!creds['phone_number_id']) {
      throw new ConnectorValidationError(
        'phone_number_id',
        'WhatsApp Phone Number ID ist erforderlich',
      )
    }
    if (!creds['verify_token']) {
      throw new ConnectorValidationError(
        'verify_token',
        'Webhook Verify Token ist erforderlich',
      )
    }
    if (!creds['app_secret']) {
      throw new ConnectorValidationError(
        'app_secret',
        'Meta App Secret ist erforderlich (für Webhook-Signaturprüfung)',
      )
    }

    // Verify credentials against the WhatsApp Cloud API
    const client = new WhatsAppCloudApiClient({
      accessToken: creds['access_token'],
      phoneNumberId: creds['phone_number_id'],
    })
    await client.validateCredentials()
  }

  async sync(
    _companyId: string,
    _connector: ConnectorConfig,
  ): Promise<SyncResult> {
    // WhatsApp is webhook-driven — sync is a no-op.
    // Messages arrive via POST /webhooks/whatsapp and are processed
    // by processWebhook() above.
    return {
      success: true,
      recordsFetched: 0,
      recordsWritten: 0,
      recordsSkipped: 0,
      errors: [],
      durationMs: 0,
    }
  }
}
