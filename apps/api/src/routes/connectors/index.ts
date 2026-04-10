import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

import { success } from '../../lib/response.js'

// ---------------------------------------------------------------------------
// Connector config routes — scoped to the current tenant.
//
// GET /connectors — list connectors for the current tenant
//
// Full CRUD and connector management will be added in Phase 4.
// ---------------------------------------------------------------------------

export default async function connectorRoutes(fastify: FastifyInstance): Promise<void> {
  // All connector routes require authentication + tenant context
  fastify.addHook('preHandler', fastify.authenticate)
  fastify.addHook('preHandler', fastify.requireTenant)
  fastify.addHook('preHandler', fastify.requirePermission('module:admin:read'))

  // -------------------------------------------------------------------------
  // GET /connectors
  // -------------------------------------------------------------------------
  fastify.get(
    '/connectors',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { companyId } = request.tenant
      const connectors = await fastify.dataAccess.connectors.findByCompanyId(companyId)

      // Strip credentials from the response — they must never be exposed
      const safe = connectors.map((c) => ({
        id: c.id,
        companyId: c.company_id,
        type: c.type,
        name: c.name,
        config: c.config,
        status: c.status,
        lastSyncedAt: c.last_synced_at,
        lastError: c.last_error,
        syncIntervalMinutes: c.sync_interval_minutes,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }))

      reply.status(200).send(success(safe, { count: safe.length }))
    },
  )
}
