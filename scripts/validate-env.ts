/**
 * Validates that all required environment variables are set.
 * Usage: pnpm validate:env
 */
import { z } from 'zod'

const ProductionEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PLATFORM_ROOT_DOMAIN: z.string().min(1),
  REDIS_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  RESEND_API_KEY: z.string().startsWith('re_'),
  ENCRYPTION_KEY: z.string().min(32),
})

const result = ProductionEnvSchema.safeParse(process.env)
if (!result.success) {
  console.error('\n❌ Missing or invalid environment variables:\n')
  result.error.errors.forEach(e => {
    console.error(`   ${e.path.join('.')}: ${e.message}`)
  })
  console.error('\n')
  process.exit(1)
} else {
  console.log('\n✅ All required environment variables are set.\n')
}
