import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CreateTenantSchema, UpdateTenantSchema } from '@enura/types'

import { success, error } from '../../lib/response.js'

// ---------------------------------------------------------------------------
// Tenant CRUD — holding admin only.
//
// GET    /tenants      — list all tenants
// GET    /tenants/:id  — get tenant by ID
// POST   /tenants      — create tenant
// PATCH  /tenants/:id  — update tenant
// ---------------------------------------------------------------------------

export default async function tenantRoutes(fastify: FastifyInstance): Promise<void> {
  // All tenant management routes require authentication + holding:global permission
  fastify.addHook('preHandler', fastify.authenticate)
  fastify.addHook('preHandler', fastify.requirePermission('holding:global'))

  // -------------------------------------------------------------------------
  // GET /tenants
  // -------------------------------------------------------------------------
  fastify.get(
    '/tenants',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const tenants = await fastify.dataAccess.companies.findAll()
      reply.status(200).send(success(tenants, { count: tenants.length }))
    },
  )

  // -------------------------------------------------------------------------
  // GET /tenants/:id
  // -------------------------------------------------------------------------
  fastify.get(
    '/tenants/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const tenant = await fastify.dataAccess.companies.findById(id)

      if (!tenant) {
        reply.status(404).send(error('NOT_FOUND', `Tenant ${id} not found`))
        return
      }

      reply.status(200).send(success(tenant))
    },
  )

  // -------------------------------------------------------------------------
  // POST /tenants
  // -------------------------------------------------------------------------
  fastify.post(
    '/tenants',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'slug'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            branding: { type: 'object' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const parseResult = CreateTenantSchema.safeParse(request.body)

      if (!parseResult.success) {
        reply.status(400).send(
          error('VALIDATION_ERROR', parseResult.error.issues.map((i) => i.message).join(', ')),
        )
        return
      }

      const { name, slug } = parseResult.data

      // Check slug uniqueness
      const existing = await fastify.dataAccess.companies.findBySlug(slug)
      if (existing) {
        reply.status(409).send(error('CONFLICT', `Slug "${slug}" is already taken`))
        return
      }

      const tenant = await fastify.dataAccess.companies.create({
        holding_id: '00000000-0000-0000-0000-000000000010',
        name,
        slug,
        created_by: request.user.userId,
      })

      reply.status(201).send(success(tenant))
    },
  )

  // -------------------------------------------------------------------------
  // PATCH /tenants/:id
  // -------------------------------------------------------------------------
  fastify.patch(
    '/tenants/:id',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string }
        Body: Record<string, unknown>
      }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params

      const parseResult = UpdateTenantSchema.safeParse(request.body)

      if (!parseResult.success) {
        reply.status(400).send(
          error('VALIDATION_ERROR', parseResult.error.issues.map((i) => i.message).join(', ')),
        )
        return
      }

      const existing = await fastify.dataAccess.companies.findById(id)
      if (!existing) {
        reply.status(404).send(error('NOT_FOUND', `Tenant ${id} not found`))
        return
      }

      const updateData = Object.fromEntries(
        Object.entries(parseResult.data).filter(([, v]) => v !== undefined),
      )
      const updated = await fastify.dataAccess.companies.update(id, updateData)
      reply.status(200).send(success(updated))
    },
  )
}
