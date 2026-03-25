import type { ProfileRow, TenantRow, DataAccess } from '@enura/types'

declare module 'fastify' {
  interface FastifyInstance {
    dataAccess: DataAccess
  }
  interface FastifyRequest {
    user: {
      userId: string
      tenantId: string | null
      roles: string[]
    }
    tenant: {
      tenantId: string
      tenant: TenantRow
    }
  }
}

// Re-export for convenience within the API codebase
export type { ProfileRow, TenantRow, DataAccess }
