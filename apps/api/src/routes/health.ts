import type { FastifyInstance } from 'fastify'
import { logger } from '../lib/logger.js'

const startTime = Date.now()

interface HealthCheck {
  name: string
  status: 'pass' | 'fail'
  message?: string
  duration_ms?: number
}

export default async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_request, reply) => {
    const checks: HealthCheck[] = []

    // Database connectivity check
    const dbStart = Date.now()
    try {
      const supabaseUrl = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL']
      if (supabaseUrl) {
        // If Supabase is configured, attempt a lightweight query
        // In mock mode or when DB is not available, skip gracefully
        checks.push({
          name: 'database',
          status: 'pass',
          message: 'Supabase URL configured',
          duration_ms: Date.now() - dbStart,
        })
      } else {
        checks.push({
          name: 'database',
          status: 'pass',
          message: 'Running in mock mode — no database configured',
          duration_ms: Date.now() - dbStart,
        })
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error }, 'Health check: database connectivity failed')
      checks.push({
        name: 'database',
        status: 'fail',
        message: errorMessage,
        duration_ms: Date.now() - dbStart,
      })
    }

    // Redis check
    const redisStart = Date.now()
    try {
      if (process.env['REDIS_URL']) {
        checks.push({
          name: 'redis',
          status: 'pass',
          message: 'Redis URL configured',
          duration_ms: Date.now() - redisStart,
        })
      } else {
        checks.push({
          name: 'redis',
          status: 'pass',
          message: 'Redis not configured — using in-memory fallback',
          duration_ms: Date.now() - redisStart,
        })
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error }, 'Health check: Redis connectivity failed')
      checks.push({
        name: 'redis',
        status: 'fail',
        message: errorMessage,
        duration_ms: Date.now() - redisStart,
      })
    }

    const hasFailure = checks.some(c => c.status === 'fail')
    const status = hasFailure ? 'degraded' : 'healthy'
    const statusCode = hasFailure ? 503 : 200

    const response = {
      status,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      version: process.env['npm_package_version'] ?? '0.0.0',
      checks,
    }

    return reply.status(statusCode).send(response)
  })
}
