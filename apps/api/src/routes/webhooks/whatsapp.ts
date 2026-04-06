import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { WhatsAppWebhookSchema } from '../../workers/connectors/whatsapp/schemas.js'
import { processWebhook } from '../../workers/connectors/whatsapp/worker.js'

// ---------------------------------------------------------------------------
// WhatsApp Webhook Routes
//
// GET  /webhooks/whatsapp — Meta webhook verification (hub.mode, hub.challenge)
// POST /webhooks/whatsapp — Incoming messages + status updates
//
// These routes are NOT authenticated via the normal JWT flow.
// Instead, POST requests are verified using HMAC-SHA256 signatures
// from Meta's X-Hub-Signature-256 header.
// ---------------------------------------------------------------------------

/**
 * Verify the HMAC-SHA256 signature of a WhatsApp webhook payload.
 * Meta signs every POST request with the app secret.
 */
function verifyWhatsAppSignature(
  appSecret: string,
  rawBody: Buffer,
  signatureHeader: string,
): boolean {
  if (!signatureHeader.startsWith('sha256=')) {
    return false
  }

  const expectedSignature = signatureHeader.slice('sha256='.length)
  const hmac = crypto.createHmac('sha256', appSecret)
  hmac.update(rawBody)
  const computedSignature = hmac.digest('hex')

  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    )
  } catch {
    return false
  }
}

/**
 * Resolve the app secret for webhook verification.
 * In production, this comes from the connector credentials stored in the DB.
 * As a fallback for initial setup, we also check the environment variable.
 */
function getAppSecret(): string {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) {
    throw new Error('WHATSAPP_APP_SECRET environment variable is not set')
  }
  return secret
}

/**
 * Resolve the verify token for webhook subscription verification.
 */
function getVerifyToken(): string {
  const token = process.env.WHATSAPP_VERIFY_TOKEN
  if (!token) {
    throw new Error('WHATSAPP_VERIFY_TOKEN environment variable is not set')
  }
  return token
}

export default async function whatsappWebhookRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // -------------------------------------------------------------------------
  // Ensure Fastify captures the raw body for signature verification.
  // This requires the rawBody plugin to be registered on the Fastify instance.
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // GET /webhooks/whatsapp — Meta Webhook Verification
  //
  // Meta sends a GET request when you subscribe to a webhook.
  // We must respond with hub.challenge if the verify_token matches.
  // -------------------------------------------------------------------------
  fastify.get(
    '/webhooks/whatsapp',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            'hub.mode': { type: 'string' },
            'hub.challenge': { type: 'string' },
            'hub.verify_token': { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          'hub.mode'?: string
          'hub.challenge'?: string
          'hub.verify_token'?: string
        }
      }>,
      reply: FastifyReply,
    ) => {
      const mode = request.query['hub.mode']
      const challenge = request.query['hub.challenge']
      const verifyToken = request.query['hub.verify_token']

      if (mode !== 'subscribe') {
        reply.status(403).send({ error: 'Invalid mode' })
        return
      }

      if (!challenge) {
        reply.status(400).send({ error: 'Missing hub.challenge' })
        return
      }

      const expectedToken = getVerifyToken()
      if (verifyToken !== expectedToken) {
        fastify.log.warn('WhatsApp webhook verification failed: token mismatch')
        reply.status(403).send({ error: 'Invalid verify token' })
        return
      }

      fastify.log.info('WhatsApp webhook verified successfully')
      // Meta expects the challenge value returned as plain text
      reply.status(200).type('text/plain').send(challenge)
    },
  )

  // -------------------------------------------------------------------------
  // POST /webhooks/whatsapp — Incoming Messages & Status Updates
  //
  // Meta sends message events and delivery status updates here.
  // We validate the signature, parse the payload, and return 200 immediately.
  // Processing happens asynchronously.
  // -------------------------------------------------------------------------
  fastify.post(
    '/webhooks/whatsapp',
    {},
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Step 1: Verify HMAC-SHA256 signature
      const signatureHeader = request.headers['x-hub-signature-256']
      if (!signatureHeader || typeof signatureHeader !== 'string') {
        fastify.log.warn('WhatsApp webhook received without signature header')
        reply.status(401).send({ error: 'Missing signature' })
        return
      }

      const appSecret = getAppSecret()
      const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody

      if (!rawBody) {
        fastify.log.error(
          'Raw body not available — ensure the rawBody plugin is registered',
        )
        reply.status(500).send({ error: 'Server configuration error' })
        return
      }

      const isValid = verifyWhatsAppSignature(appSecret, rawBody, signatureHeader)
      if (!isValid) {
        fastify.log.warn('WhatsApp webhook signature verification failed')
        reply.status(401).send({ error: 'Invalid signature' })
        return
      }

      // Step 2: Parse the webhook payload
      const parseResult = WhatsAppWebhookSchema.safeParse(request.body)
      if (!parseResult.success) {
        fastify.log.warn(
          { error: parseResult.error.message },
          'WhatsApp webhook payload validation failed',
        )
        // Return 200 anyway to prevent Meta from retrying a permanently invalid payload
        reply.status(200).send({ status: 'ignored' })
        return
      }

      // Step 3: Return 200 immediately to Meta (must respond within 5 seconds)
      reply.status(200).send({ status: 'received' })

      // Step 4: Process asynchronously (after response is sent)
      // Use setImmediate to defer processing until after the response
      setImmediate(async () => {
        try {
          const result = await processWebhook(parseResult.data)
          if (result.errors.length > 0) {
            fastify.log.warn(
              { errors: result.errors, processed: result.processed },
              'WhatsApp webhook processing completed with errors',
            )
          } else {
            fastify.log.info(
              { processed: result.processed },
              'WhatsApp webhook processed successfully',
            )
          }
        } catch (err) {
          fastify.log.error(
            { error: err instanceof Error ? err.message : String(err) },
            'WhatsApp webhook processing failed',
          )
        }
      })
    },
  )
}

export { verifyWhatsAppSignature }
