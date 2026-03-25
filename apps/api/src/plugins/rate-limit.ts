import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'

export default fp(async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      const user = (request as unknown as Record<string, unknown>)['user'] as Record<string, string> | undefined
      return user?.['userId'] ?? request.ip
    },
    errorResponseBuilder: () => ({
      data: null,
      error: {
        code: 'RATE_LIMITED',
        message: 'Zu viele Anfragen. Bitte versuchen Sie es in einer Minute erneut.',
      },
    }),
  })
})
