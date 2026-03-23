import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

import { error } from '../lib/response.js'

// ---------------------------------------------------------------------------
// Plugin — provides a `requirePermission(key)` helper that returns a
// preHandler hook. The hook verifies that the user's roles grant the
// requested permission key.
// ---------------------------------------------------------------------------

async function permissionsPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorate(
    'requirePermission',
    function requirePermission(
      permissionKey: string,
    ): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
      return async function permissionHook(
        request: FastifyRequest,
        reply: FastifyReply,
      ): Promise<void> {
        const { userId, roles: roleKeys } = request.user

        // Holding admins with the special 'holding:global' permission bypass
        // all permission checks — they can access everything.
        const allPermissions: string[] = []

        // Resolve permissions for each role the user has
        for (const _roleKey of roleKeys) {
          // Look up the role by key to get the role id
          // For the mock layer the roles array from the token already contains role keys,
          // but the data access layer works with role IDs. In the mock we stored
          // role IDs in MOCK_PROFILE_ROLES, so we look up roles by profile.
          const userRoles = await fastify.dataAccess.roles.findByProfileId(userId)

          for (const role of userRoles) {
            const perms = await fastify.dataAccess.roles.getPermissions(role.id)
            allPermissions.push(...perms)
          }
        }

        // Deduplicate
        const uniquePermissions = [...new Set(allPermissions)]

        // Holding admins bypass all checks
        if (uniquePermissions.includes('holding:global')) {
          return
        }

        if (!uniquePermissions.includes(permissionKey)) {
          reply.status(403).send(
            error(
              'FORBIDDEN',
              `Missing required permission: ${permissionKey}`,
            ),
          )
        }
      }
    },
  )
}

declare module 'fastify' {
  interface FastifyInstance {
    requirePermission: (
      permissionKey: string,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(permissionsPlugin, {
  name: 'permissions',
  dependencies: ['authenticate'],
  fastify: '4.x',
})
