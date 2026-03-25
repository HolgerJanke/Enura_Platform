import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CreateUserSchema } from '@enura/types'
import { z } from 'zod'

import { success, error } from '../../lib/response.js'

// ---------------------------------------------------------------------------
// User CRUD — scoped to the current tenant.
//
// GET   /users      — list users in current tenant
// POST  /users      — create user in current tenant
// PATCH /users/:id  — update user in current tenant
// ---------------------------------------------------------------------------

const UpdateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional(),
  isActive: z.boolean().optional(),
})

export default async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // All user routes require authentication + tenant context
  fastify.addHook('preHandler', fastify.authenticate)
  fastify.addHook('preHandler', fastify.requireTenant)
  fastify.addHook('preHandler', fastify.requirePermission('module:admin:read'))

  // -------------------------------------------------------------------------
  // GET /users
  // -------------------------------------------------------------------------
  fastify.get(
    '/users',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId } = request.tenant
      const profiles = await fastify.dataAccess.profiles.findByTenantId(tenantId)

      reply.status(200).send(success(profiles, { count: profiles.length }))
    },
  )

  // -------------------------------------------------------------------------
  // POST /users
  // -------------------------------------------------------------------------
  fastify.post(
    '/users',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'firstName', 'lastName', 'roleIds'],
          properties: {
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            roleIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const parseResult = CreateUserSchema.safeParse(request.body)

      if (!parseResult.success) {
        reply.status(400).send(
          error('VALIDATION_ERROR', parseResult.error.issues.map((i) => i.message).join(', ')),
        )
        return
      }

      const { email, firstName, lastName } = parseResult.data
      const { tenantId } = request.tenant

      // Check for duplicate email
      const existingProfile = await fastify.dataAccess.profiles.findByEmail(email)
      if (existingProfile && existingProfile.tenant_id === tenantId) {
        reply.status(409).send(error('CONFLICT', `User with email ${email} already exists in this tenant`))
        return
      }

      // In production, this would:
      // 1. Create a Supabase Auth user with a temporary password
      // 2. Create a profile row
      // 3. Assign roles via profile_roles
      // For now, mock the profile creation
      const profile = await fastify.dataAccess.profiles.create({
        id: `usr_${Date.now()}`,
        tenant_id: tenantId,
        first_name: firstName,
        last_name: lastName,
        must_reset_password: true,
        totp_enabled: false,
      })

      reply.status(201).send(success(profile))
    },
  )

  // -------------------------------------------------------------------------
  // PATCH /users/:id
  // -------------------------------------------------------------------------
  fastify.patch(
    '/users/:id',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            isActive: { type: 'boolean' },
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
      const { tenantId } = request.tenant

      const parseResult = UpdateUserSchema.safeParse(request.body)

      if (!parseResult.success) {
        reply.status(400).send(
          error('VALIDATION_ERROR', parseResult.error.issues.map((i) => i.message).join(', ')),
        )
        return
      }

      const existing = await fastify.dataAccess.profiles.findById(id)

      if (!existing || existing.tenant_id !== tenantId) {
        reply.status(404).send(error('NOT_FOUND', `User ${id} not found in this tenant`))
        return
      }

      const updateData: Record<string, unknown> = {}
      if (parseResult.data.firstName !== undefined) updateData['first_name'] = parseResult.data.firstName
      if (parseResult.data.lastName !== undefined) updateData['last_name'] = parseResult.data.lastName
      if (parseResult.data.phone !== undefined) updateData['phone'] = parseResult.data.phone
      if (parseResult.data.isActive !== undefined) updateData['is_active'] = parseResult.data.isActive

      const updated = await fastify.dataAccess.profiles.update(id, updateData)

      reply.status(200).send(success(updated))
    },
  )
}
