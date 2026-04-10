interface EnvVarSpec {
  readonly name: string
  readonly requiredInProduction: boolean
  readonly requiredInDevelopment: boolean
  readonly alternatives?: ReadonlyArray<string>
}

const ENV_VARS: ReadonlyArray<EnvVarSpec> = [
  {
    name: 'SUPABASE_URL',
    requiredInProduction: true,
    requiredInDevelopment: true,
    alternatives: ['NEXT_PUBLIC_SUPABASE_URL'],
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    requiredInProduction: true,
    requiredInDevelopment: true,
  },
  {
    name: 'REDIS_URL',
    requiredInProduction: true,
    requiredInDevelopment: false,
  },
  {
    name: 'ANTHROPIC_API_KEY',
    requiredInProduction: true,
    requiredInDevelopment: false,
  },
  {
    name: 'OPENAI_API_KEY',
    requiredInProduction: true,
    requiredInDevelopment: false,
  },
  {
    name: 'RESEND_API_KEY',
    requiredInProduction: true,
    requiredInDevelopment: false,
  },
]

function isVarPresent(spec: EnvVarSpec): boolean {
  if (process.env[spec.name]) return true
  if (spec.alternatives) {
    return spec.alternatives.some((alt) => Boolean(process.env[alt]))
  }
  return false
}

/**
 * Validates that all required environment variables are set.
 * In production, all vars are required. In development, only Supabase vars are required.
 * Throws an error listing all missing variables if validation fails.
 */
export function assertRequiredEnvVars(): void {
  const isProduction = process.env.NODE_ENV === 'production'
  const missing: string[] = []

  for (const spec of ENV_VARS) {
    const isRequired = isProduction
      ? spec.requiredInProduction
      : spec.requiredInDevelopment

    if (isRequired && !isVarPresent(spec)) {
      const label = spec.alternatives
        ? `${spec.name} (oder ${spec.alternatives.join(' / ')})`
        : spec.name
      missing.push(label)
    }
  }

  if (missing.length > 0) {
    const environment = isProduction ? 'Production' : 'Development'
    const list = missing.map((v) => `  - ${v}`).join('\n')
    throw new Error(
      `[env-check] ${environment}: Fehlende Umgebungsvariablen:\n${list}\n\n` +
        `Bitte setzen Sie die fehlenden Variablen bevor die Applikation gestartet wird.`
    )
  }
}
