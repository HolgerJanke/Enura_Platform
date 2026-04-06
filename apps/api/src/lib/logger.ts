import pino from 'pino'

const baseOpts = {
  level: process.env['LOG_LEVEL'] ?? 'info',
  base: {
    service: 'enura-api',
    env: process.env['NODE_ENV'] ?? 'development',
  },
  redact: {
    paths: [
      'credentials',
      'password',
      'api_key',
      'access_token',
      'refresh_token',
      'authorization',
      '*.credentials',
      '*.api_key',
    ],
    censor: '[REDACTED]',
  },
}

export const logger =
  process.env['NODE_ENV'] === 'development'
    ? pino({ ...baseOpts, transport: { target: 'pino-pretty', options: { colorize: true } } })
    : pino(baseOpts)

export function createRequestLogger(correlationId: string) {
  return logger.child({ correlationId })
}
