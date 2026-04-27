import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Reonic webhook receiver.
 *
 * Reonic sends webhooks via Zapier or its native integration on key events:
 *   - offer.signed     — customer has signed an offer (DF-05)
 *   - offer.created    — new offer in pipeline   (DF-09)
 *   - request.created  — new lead/request        (DF-10)
 *
 * The most important is `offer.signed`: that's when a deal closes and we
 * need to create a corresponding contact + order in Bexio (DF-06 + DF-07)
 * so the accounting team has the data without manual re-keying.
 *
 * Authorization: shared secret header `x-reonic-secret` matched against
 * `REONIC_WEBHOOK_SECRET` environment variable. Set the same value on the
 * Reonic/Zapier side.
 *
 * Idempotency: each webhook payload includes an `event_id`. We log it in
 * the `webhook_events` table — if we've already seen it we no-op.
 */

interface ReonicWebhookPayload {
  event_id?: string
  event_type: 'offer.signed' | 'offer.created' | 'request.created' | string
  company_id?: string
  data: Record<string, unknown>
}

interface ReonicOfferData {
  id?: string | number
  contactId?: string | number
  contact?: { id?: string | number; email?: string; firstName?: string; lastName?: string; phone?: string } | undefined
  customDealValue?: number
  totalPlannedPrice?: number
  status?: string
  state?: string
  signedAt?: string
  // Address fields (vary by Reonic version)
  street?: string
  streetNumber?: string
  city?: string
  postcode?: string
  country?: string
}

export async function POST(request: NextRequest) {
  // Auth check
  const expectedSecret = process.env['REONIC_WEBHOOK_SECRET']
  const providedSecret = request.headers.get('x-reonic-secret')
  if (!expectedSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  let payload: ReonicWebhookPayload
  try {
    payload = (await request.json()) as ReonicWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!payload.event_type || !payload.data) {
    return NextResponse.json({ error: 'Missing event_type or data' }, { status: 400 })
  }

  const db = createSupabaseServiceClient()

  // Idempotency: skip if we've seen this event_id before
  if (payload.event_id) {
    const { data: existing } = await db
      .from('webhook_events')
      .select('id')
      .eq('source', 'reonic')
      .eq('external_event_id', payload.event_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ status: 'already_processed', event_id: payload.event_id })
    }
  }

  // Determine company — webhooks come from a specific Reonic tenant. We
  // resolve the company by matching the Reonic client_id stored in the
  // connector config.
  const reonicClientId = (payload.company_id as string) ?? null
  let companyId: string | null = null

  if (reonicClientId) {
    const { data: connector } = await db
      .from('connectors')
      .select('company_id')
      .eq('type', 'reonic')
      .filter('credentials->>clientId', 'eq', reonicClientId)
      .maybeSingle()
    companyId = (connector as Record<string, unknown> | null)?.['company_id'] as string ?? null
  }

  // Fallback: only one Reonic-connected company → use that
  if (!companyId) {
    const { data: connectors } = await db
      .from('connectors')
      .select('company_id')
      .eq('type', 'reonic')
      .eq('status', 'active')
    if (connectors && connectors.length === 1) {
      companyId = (connectors[0] as Record<string, unknown>)['company_id'] as string
    }
  }

  if (!companyId) {
    return NextResponse.json({
      error: 'Could not resolve company for this webhook',
      hint: 'Ensure the Reonic connector for this client is active and the client_id matches',
    }, { status: 422 })
  }

  // Log the webhook
  const { data: logged } = await db
    .from('webhook_events')
    .insert({
      source: 'reonic',
      external_event_id: payload.event_id ?? null,
      event_type: payload.event_type,
      company_id: companyId,
      payload: payload.data,
      status: 'received',
    })
    .select('id')
    .single()

  const webhookEventId = (logged as Record<string, unknown> | null)?.['id'] as string | undefined

  // Dispatch by event type
  let result: Record<string, unknown> = { status: 'logged' }

  try {
    if (payload.event_type === 'offer.signed') {
      result = await handleOfferSigned(db, companyId, payload.data as ReonicOfferData)
    }
    // Other events (offer.created, request.created) are just logged for now —
    // the connector sync picks them up in the next polling cycle.

    if (webhookEventId) {
      await db
        .from('webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', webhookEventId)
    }

    return NextResponse.json({ success: true, event_type: payload.event_type, ...result })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    if (webhookEventId) {
      await db
        .from('webhook_events')
        .update({ status: 'error', error_message: errorMsg })
        .eq('id', webhookEventId)
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

/**
 * DF-05 + DF-06 + DF-07: When an offer is signed in Reonic, ensure the
 * customer exists as a contact in Bexio (create if not), then create
 * an order linked to that contact.
 *
 * No down-payment invoice yet — that's DF-08, follows once order
 * confirmation is finalised by accounting.
 */
async function handleOfferSigned(
  db: ReturnType<typeof createSupabaseServiceClient>,
  companyId: string,
  offer: ReonicOfferData,
): Promise<Record<string, unknown>> {
  // Get Bexio access token from the connector
  const { data: bexioConnector } = await db
    .from('connectors')
    .select('credentials')
    .eq('company_id', companyId)
    .eq('type', 'bexio')
    .eq('status', 'active')
    .maybeSingle()

  const bexioCreds = (bexioConnector as Record<string, unknown> | null)?.['credentials'] as Record<string, unknown> | null
  const accessToken = bexioCreds?.['access_token'] as string | undefined

  if (!accessToken) {
    return { warning: 'Bexio not connected — order not created' }
  }

  const contact = offer.contact
  if (!contact) {
    return { warning: 'No contact in offer — cannot create Bexio entry' }
  }

  // 1. Find-or-create Bexio contact
  const bexioContactId = await findOrCreateBexioContact(accessToken, {
    email: contact.email ?? '',
    firstName: contact.firstName ?? '',
    lastName: contact.lastName ?? '',
    phone: contact.phone ?? '',
    street: offer.street ?? '',
    streetNumber: offer.streetNumber ?? '',
    city: offer.city ?? '',
    postcode: offer.postcode ?? '',
    country: offer.country ?? 'CH',
  })

  if (!bexioContactId) {
    return { warning: 'Could not find or create Bexio contact' }
  }

  // 2. Create Bexio order (kb_order)
  const orderValue = offer.customDealValue ?? offer.totalPlannedPrice ?? 0
  const orderId = await createBexioOrder(accessToken, {
    contact_id: bexioContactId,
    title: `Reonic Auftrag #${offer.id ?? 'unknown'}`,
    total: orderValue,
  })

  if (!orderId) {
    return { warning: 'Bexio contact created but order creation failed', bexio_contact_id: bexioContactId }
  }

  return {
    bexio_contact_id: bexioContactId,
    bexio_order_id: orderId,
    order_value: orderValue,
  }
}

const BEXIO_API_BASE = 'https://api.bexio.com/2.0'

async function findOrCreateBexioContact(
  accessToken: string,
  contact: {
    email: string
    firstName: string
    lastName: string
    phone: string
    street: string
    streetNumber: string
    city: string
    postcode: string
    country: string
  },
): Promise<number | null> {
  // Search by email first (dedup) — Bexio's contact search supports email filter
  if (contact.email) {
    try {
      const searchRes = await fetch(`${BEXIO_API_BASE}/contact/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify([
          { field: 'mail', value: contact.email, criteria: '=' },
        ]),
      })
      if (searchRes.ok) {
        const matches = (await searchRes.json()) as Array<{ id: number }>
        if (Array.isArray(matches) && matches.length > 0 && matches[0]?.id) {
          return matches[0].id
        }
      }
    } catch {
      // Fall through to create
    }
  }

  // Create new contact (contact_type 1 = company / 2 = person — we default to person)
  const createRes = await fetch(`${BEXIO_API_BASE}/contact`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      contact_type_id: 2,
      name_1: contact.lastName || contact.email || 'Unbekannt',
      name_2: contact.firstName,
      mail: contact.email,
      phone_fixed: contact.phone,
      address: contact.streetNumber ? `${contact.street} ${contact.streetNumber}`.trim() : contact.street,
      postcode: contact.postcode,
      city: contact.city,
      country_id: contact.country === 'DE' ? 1 : 2,
      user_id: 1,
      owner_id: 1,
    }),
  })

  if (!createRes.ok) {
    return null
  }

  const created = (await createRes.json()) as { id?: number }
  return created.id ?? null
}

async function createBexioOrder(
  accessToken: string,
  order: { contact_id: number; title: string; total: number },
): Promise<number | null> {
  const today = new Date().toISOString().split('T')[0]

  const createRes = await fetch(`${BEXIO_API_BASE}/kb_order`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      contact_id: order.contact_id,
      user_id: 1,
      title: order.title,
      is_valid_from: today,
      currency_id: 1, // CHF
      positions: [
        {
          type: 'KbPositionCustom',
          amount: 1,
          unit_price: order.total,
          tax_id: 1,
          text: order.title,
        },
      ],
    }),
  })

  if (!createRes.ok) {
    return null
  }

  const created = (await createRes.json()) as { id?: number }
  return created.id ?? null
}
