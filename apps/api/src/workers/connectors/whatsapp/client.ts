import { ConnectorAuthError } from '../base.js'

// ---------------------------------------------------------------------------
// WhatsApp Cloud API Client
//
// Used for sending outbound messages. Receiving is handled via webhooks.
// https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
// ---------------------------------------------------------------------------

export interface WhatsAppClientConfig {
  accessToken: string
  phoneNumberId: string
  apiVersion?: string
}

export interface SendTextMessageParams {
  to: string
  body: string
  previewUrl?: boolean
}

export interface SendMessageResult {
  messageId: string
  waId: string
}

const DEFAULT_API_VERSION = 'v19.0'
const BASE_URL = 'https://graph.facebook.com'

export class WhatsAppCloudApiClient {
  private readonly accessToken: string
  private readonly phoneNumberId: string
  private readonly baseUrl: string

  constructor(config: WhatsAppClientConfig) {
    this.accessToken = config.accessToken
    this.phoneNumberId = config.phoneNumberId
    const version = config.apiVersion ?? DEFAULT_API_VERSION
    this.baseUrl = `${BASE_URL}/${version}/${this.phoneNumberId}`
  }

  /**
   * Send a text message via the WhatsApp Cloud API.
   */
  async sendTextMessage(params: SendTextMessageParams): Promise<SendMessageResult> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.to,
        type: 'text',
        text: {
          preview_url: params.previewUrl ?? false,
          body: params.body,
        },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      if (response.status === 401 || response.status === 403) {
        throw new ConnectorAuthError(
          `WhatsApp API auth failed (${response.status}): ${errorBody}`,
        )
      }
      throw new Error(
        `WhatsApp API error (${response.status}): ${errorBody}`,
      )
    }

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>
      contacts?: Array<{ wa_id: string }>
    }

    const messageId = data.messages?.[0]?.id
    const waId = data.contacts?.[0]?.wa_id

    if (!messageId) {
      throw new Error('WhatsApp API did not return a message ID')
    }

    return {
      messageId,
      waId: waId ?? params.to,
    }
  }

  /**
   * Verify that the access token and phone number ID are valid by
   * requesting the phone number details.
   */
  async validateCredentials(): Promise<void> {
    const response = await fetch(
      `${BASE_URL}/${DEFAULT_API_VERSION}/${this.phoneNumberId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new ConnectorAuthError(
        `WhatsApp credential validation failed (${response.status}): ${errorBody}`,
      )
    }
  }
}
