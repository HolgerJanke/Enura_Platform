import './types.js'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createMockDataAccess } from '@enura/types'

import authenticatePlugin from './plugins/authenticate.js'
import tenantPlugin from './plugins/tenant.js'
import permissionsPlugin from './plugins/permissions.js'
import healthRoutes from './routes/health.js'
import authRoutes from './routes/auth/index.js'
import tenantRoutes from './routes/tenants/index.js'
import userRoutes from './routes/users/index.js'
import connectorRoutes from './routes/connectors/index.js'

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const isDev = process.env['NODE_ENV'] !== 'production'
  const fastify = Fastify({
    logger: isDev
      ? {
          level: process.env['LOG_LEVEL'] ?? 'info',
          transport: { target: 'pino-pretty', options: { colorize: true } },
        }
      : { level: process.env['LOG_LEVEL'] ?? 'info' },
  })

  // -----------------------------------------------------------------------
  // Data access layer (mock for Phase 1, will be swapped to Supabase in Phase 3)
  // -----------------------------------------------------------------------
  const dataAccess = createMockDataAccess()
  fastify.decorate('dataAccess', dataAccess)

  // -----------------------------------------------------------------------
  // Global plugins
  // -----------------------------------------------------------------------
  await fastify.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? true,
    credentials: true,
  })

  // -----------------------------------------------------------------------
  // Custom plugins (order matters — tenant depends on authenticate)
  // -----------------------------------------------------------------------
  await fastify.register(authenticatePlugin)
  await fastify.register(tenantPlugin)
  await fastify.register(permissionsPlugin)

  // -----------------------------------------------------------------------
  // Routes
  // -----------------------------------------------------------------------
  await fastify.register(healthRoutes)
  await fastify.register(authRoutes, { prefix: '/auth' })
  await fastify.register(tenantRoutes)
  await fastify.register(userRoutes)
  await fastify.register(connectorRoutes)

  // -----------------------------------------------------------------------
  // Global error handler — consistent envelope
  // -----------------------------------------------------------------------
  fastify.setErrorHandler((err, _request, reply) => {
    const statusCode = err.statusCode ?? 500
    const message = statusCode >= 500 ? 'Internal server error' : err.message

    fastify.log.error(err)

    reply.status(statusCode).send({
      data: null,
      error: {
        code: err.code ?? 'INTERNAL_ERROR',
        message,
      },
    })
  })

  // -----------------------------------------------------------------------
  // Start
  // -----------------------------------------------------------------------
  const port = Number(process.env['PORT'] ?? 3001)
  const host = process.env['HOST'] ?? '0.0.0.0'

  try {
    await fastify.listen({ port, host })
    fastify.log.info(`Enura API running on http://${host}:${port}`)
  } catch (err) {
    fastify.log.fatal(err)
    process.exit(1)
  }
}

main()
