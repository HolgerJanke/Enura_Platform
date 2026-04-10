import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

import { error } from '../lib/response.js'

// ---------------------------------------------------------------------------
// Plugin — resolves tenant from the authenticated user's companyId,
// fetches the tenant from data access, and attaches it to the request.
// ---------------------------------------------------------------------------

async function tenantPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('tenant', null)

  fastify.decorate(
    'requireTenant',
    async function requireTenantHook(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      const { companyId } = request.user

      if (!companyId) {
        reply
          .status(400)
          .send(error('TENANT_REQUIRED', 'This endpoint requires a tenant context'))
        return
      }

      const tenant = await fastify.dataAccess.companies.findById(companyId)

      if (!tenant) {
        reply.status(404).send(error('TENANT_NOT_FOUND', `Tenant ${companyId} not found`))
        return
      }

      if (tenant.status !== 'active') {
        reply
          .status(403)
          .send(error('TENANT_INACTIVE', `Tenant ${tenant.name} is ${tenant.status}`))
        return
      }

      request.tenant = {
        companyId: tenant.id,
        tenant,
      }
    },
  )
}

declare module 'fastify' {
  interface FastifyInstance {
    requireTenant: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(tenantPlugin, {
  name: 'tenant',
  dependencies: ['authenticate'],
  fastify: '4.x',
})
