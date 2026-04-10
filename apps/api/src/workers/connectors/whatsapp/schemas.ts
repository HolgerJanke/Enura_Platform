import { z } from 'zod'

// ---------------------------------------------------------------------------
// WhatsApp Cloud API Webhook Payload Schemas
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
// ---------------------------------------------------------------------------

export const WhatsAppContactSchema = z
  .object({
    wa_id: z.string(),
    profile: z
      .object({
        name: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()

export type WhatsAppContact = z.infer<typeof WhatsAppContactSchema>

export const WhatsAppIncomingMessageSchema = z
  .object({
    id: z.string(),
    from: z.string(),
    timestamp: z.string(),
    type: z.enum([
      'text',
      'image',
      'video',
      'audio',
      'document',
      'location',
      'contacts',
      'sticker',
      'reaction',
      'interactive',
      'button',
      'order',
      'system',
      'unknown',
    ]),
    text: z
      .object({
        body: z.string(),
      })
      .optional(),
  })
  .passthrough()

export type WhatsAppIncomingMessage = z.infer<typeof WhatsAppIncomingMessageSchema>

export const WhatsAppStatusSchema = z
  .object({
    id: z.string(),
    status: z.enum(['sent', 'delivered', 'read', 'failed']),
    timestamp: z.string(),
    recipient_id: z.string(),
  })
  .passthrough()

export type WhatsAppStatus = z.infer<typeof WhatsAppStatusSchema>

export const WhatsAppMetadataSchema = z.object({
  display_phone_number: z.string(),
  phone_number_id: z.string(),
})

export type WhatsAppMetadata = z.infer<typeof WhatsAppMetadataSchema>

export const WhatsAppValueSchema = z
  .object({
    messaging_product: z.literal('whatsapp'),
    metadata: WhatsAppMetadataSchema,
    contacts: z.array(WhatsAppContactSchema).optional(),
    messages: z.array(WhatsAppIncomingMessageSchema).optional(),
    statuses: z.array(WhatsAppStatusSchema).optional(),
  })
  .passthrough()

export type WhatsAppValue = z.infer<typeof WhatsAppValueSchema>

export const WhatsAppChangeSchema = z.object({
  value: WhatsAppValueSchema,
  field: z.string(),
})

export type WhatsAppChange = z.infer<typeof WhatsAppChangeSchema>

export const WhatsAppEntrySchema = z.object({
  id: z.string(),
  changes: z.array(WhatsAppChangeSchema),
})

export type WhatsAppEntry = z.infer<typeof WhatsAppEntrySchema>

export const WhatsAppWebhookSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(WhatsAppEntrySchema),
})

export type WhatsAppWebhook = z.infer<typeof WhatsAppWebhookSchema>

// ---------------------------------------------------------------------------
// Internal normalised message schema (what we write to whatsapp_messages)
// ---------------------------------------------------------------------------

export const WhatsAppMessageDirection = z.enum(['inbound', 'outbound'])

export const WhatsAppMessageSchema = z.object({
  company_id: z.string().uuid(),
  external_id: z.string(),
  wa_id: z.string(),
  direction: WhatsAppMessageDirection,
  message_type: z.string(),
  body: z.string().nullable(),
  team_member_id: z.string().uuid().nullable(),
  lead_id: z.string().uuid().nullable(),
  sent_at: z.string(),
})

export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>
