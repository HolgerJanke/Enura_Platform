import type { ProfileRow, CompanyRow, DataAccess } from '@enura/types'

declare module 'fastify' {
  interface FastifyInstance {
    dataAccess: DataAccess
  }
  interface FastifyRequest {
    user: {
      userId: string
      companyId: string | null
      roles: string[]
    }
    tenant: {
      companyId: string
      tenant: CompanyRow
    }
  }
}

// Re-export for convenience within the API codebase
export type { ProfileRow, CompanyRow, DataAccess }
