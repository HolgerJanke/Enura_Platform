import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

import { error } from '../lib/response.js'

// ---------------------------------------------------------------------------
// Token shape — during Phase 1 (mock auth) the token is base64-encoded JSON.
// In production this will be replaced by Supabase JWT verification.
// ---------------------------------------------------------------------------

interface TokenPayload {
  userId: string
  tenantId: string | null
  roles: string[]
}

function decodeToken(header: string | undefined): TokenPayload | null {
  if (!header) return null

  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null

  const token = parts[1]
  if (!token) return null

  try {
    const json = Buffer.from(token, 'base64').toString('utf-8')
    const parsed: unknown = JSON.parse(json)

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('userId' in parsed) ||
      !('roles' in parsed)
    ) {
      return null
    }

    const obj = parsed as Record<string, unknown>

    if (typeof obj['userId'] !== 'string') return null
    if (!Array.isArray(obj['roles'])) return null
    if (
      obj['tenantId'] !== null &&
      obj['tenantId'] !== undefined &&
      typeof obj['tenantId'] !== 'string'
    ) {
      return null
    }

    return {
      userId: obj['userId'] as string,
      tenantId: (obj['tenantId'] as string | null) ?? null,
      roles: obj['roles'] as string[],
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

async function authenticatePlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('user', null)

  fastify.decorate(
    'authenticate',
    async function authenticateHook(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      const payload = decodeToken(request.headers.authorization)

      if (!payload) {
        reply.status(401).send(error('UNAUTHORIZED', 'Missing or invalid authorization token'))
        return
      }

      request.user = {
        userId: payload.userId,
        tenantId: payload.tenantId,
        roles: payload.roles,
      }
    },
  )
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(authenticatePlugin, {
  name: 'authenticate',
  fastify: '4.x',
})
