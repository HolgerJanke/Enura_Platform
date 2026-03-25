import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3001'),
  SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  REDIS_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MOCK_MODE: z.string().default('true'),
})

let _env: z.infer<typeof EnvSchema> | null = null

export function getEnv(): z.infer<typeof EnvSchema> {
  if (_env) return _env
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    console.error('⚠️ Environment validation warnings:')
    result.error.errors.forEach(e => {
      console.error(`   ${e.path.join('.')}: ${e.message}`)
    })
    // Don't exit — use defaults for development
    _env = EnvSchema.parse({})
    return _env
  }
  _env = result.data
  return _env
}
