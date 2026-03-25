import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { LoginSchema, ResetPasswordSchema, VerifyTotpSchema } from '@enura/types'

import { success, error } from '../../lib/response.js'

// ---------------------------------------------------------------------------
// Mock auth routes — Phase 1 (no real Supabase Auth yet).
//
// POST /auth/login        — accepts any email + password "Test1234!" → token
// POST /auth/reset-password — validates the password schema, returns success
// POST /auth/verify-totp   — validates 6-digit code format, returns success
// ---------------------------------------------------------------------------

const MOCK_PASSWORD = 'Test1234!'

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /auth/login
  // -------------------------------------------------------------------------
  fastify.post(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { email: string; password: string } }>,
      reply: FastifyReply,
    ) => {
      const parseResult = LoginSchema.safeParse(request.body)

      if (!parseResult.success) {
        reply.status(400).send(
          error('VALIDATION_ERROR', parseResult.error.issues.map((i) => i.message).join(', ')),
        )
        return
      }

      const { email, password } = parseResult.data

      if (password !== MOCK_PASSWORD) {
        reply.status(401).send(error('INVALID_CREDENTIALS', 'Invalid email or password'))
        return
      }

      // Try to find the user by email in the mock data
      const profile = await fastify.dataAccess.profiles.findByEmail(email)

      // For mock: if no profile found we still create a token with defaults
      const userId = profile?.id ?? 'usr_mock'
      const tenantId = profile?.tenant_id ?? null
      const roleKeys: string[] = []

      if (profile) {
        const userRoles = await fastify.dataAccess.roles.findByProfileId(profile.id)
        roleKeys.push(...userRoles.map((r) => r.key))
      }

      const tokenPayload = {
        userId,
        tenantId,
        roles: roleKeys,
      }

      const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64')

      const responseData = {
        token,
        user: {
          id: userId,
          email,
          displayName: profile?.display_name ?? email,
          mustResetPassword: profile?.must_reset_password ?? true,
          totpEnabled: profile?.totp_enabled ?? false,
        },
      }

      reply.status(200).send(success(responseData))
    },
  )

  // -------------------------------------------------------------------------
  // POST /auth/reset-password
  // -------------------------------------------------------------------------
  fastify.post(
    '/auth/reset-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['password', 'confirmPassword'],
          properties: {
            password: { type: 'string' },
            confirmPassword: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { password: string; confirmPassword: string } }>,
      reply: FastifyReply,
    ) => {
      const parseResult = ResetPasswordSchema.safeParse(request.body)

      if (!parseResult.success) {
        reply.status(400).send(
          error('VALIDATION_ERROR', parseResult.error.issues.map((i) => i.message).join(', ')),
        )
        return
      }

      // In production this would update the password via Supabase Auth
      // and set must_reset_password = false on the profile.
      reply.status(200).send(
        success({ message: 'Password reset successfully' }),
      )
    },
  )

  // -------------------------------------------------------------------------
  // POST /auth/verify-totp
  // -------------------------------------------------------------------------
  fastify.post(
    '/auth/verify-totp',
    {
      schema: {
        body: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { code: string } }>,
      reply: FastifyReply,
    ) => {
      const parseResult = VerifyTotpSchema.safeParse(request.body)

      if (!parseResult.success) {
        reply.status(400).send(
          error('VALIDATION_ERROR', parseResult.error.issues.map((i) => i.message).join(', ')),
        )
        return
      }

      // In production this would verify the TOTP code against the user's secret
      // and set totp_enabled = true if this is first enrolment.
      reply.status(200).send(
        success({ message: 'TOTP verified successfully', totpEnabled: true }),
      )
    },
  )
}
