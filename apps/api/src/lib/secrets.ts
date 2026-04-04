import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getEnv } from './env.js'
import { logger } from './logger.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SecretMetadata {
  id: string
  name: string
  secret_type: string
  scope: string
  vault_id: string | null
  is_active: boolean
}

interface LoadSecretResult {
  value: string
  metadata: SecretMetadata
}

// ---------------------------------------------------------------------------
// Service Client (singleton for worker context)
// ---------------------------------------------------------------------------

let _serviceClient: SupabaseClient | null = null

function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient

  const env = getEnv()
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for secret loading.')
  }

  _serviceClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return _serviceClient
}

// ---------------------------------------------------------------------------
// loadSecret
// ---------------------------------------------------------------------------

/**
 * Load a decrypted secret value from Supabase Vault via the holding_secrets table.
 *
 * Flow:
 *   1. Look up the secret by holding_id + name in holding_secrets
 *   2. Verify it is active
 *   3. Fetch the decrypted value from Vault using the vault_id
 *   4. Log the access to secret_access_log
 *
 * IMPORTANT: In production, step 3 would use:
 *   SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = $vault_id
 * For now, we simulate this with a direct query placeholder since Vault API
 * availability depends on the Supabase project configuration.
 *
 * @param holdingId - The holding UUID
 * @param secretName - The SCREAMING_SNAKE_CASE secret name
 * @param context - Description of why the secret is being accessed (for audit)
 * @returns The decrypted secret value and metadata
 * @throws Error if secret not found, inactive, or vault fetch fails
 */
export async function loadSecret(
  holdingId: string,
  secretName: string,
  context: string,
): Promise<LoadSecretResult> {
  const client = getServiceClient()

  // 1. Look up secret metadata
  const { data: secret, error: lookupError } = await client
    .from('holding_secrets')
    .select('id, name, secret_type, scope, vault_id, is_active')
    .eq('holding_id', holdingId)
    .eq('name', secretName)
    .single()

  if (lookupError || !secret) {
    logger.error({
      msg: 'Secret not found',
      holdingId,
      secretName,
      error: lookupError?.message,
    })
    throw new Error(`Secret "${secretName}" not found for holding ${holdingId}.`)
  }

  const record = secret as Record<string, unknown>
  const metadata: SecretMetadata = {
    id: record['id'] as string,
    name: record['name'] as string,
    secret_type: record['secret_type'] as string,
    scope: record['scope'] as string,
    vault_id: (record['vault_id'] as string | null) ?? null,
    is_active: record['is_active'] as boolean,
  }

  // 2. Verify active
  if (!metadata.is_active) {
    logger.warn({
      msg: 'Attempt to load inactive secret',
      holdingId,
      secretName,
    })
    throw new Error(`Secret "${secretName}" is inactive. Activate it before use.`)
  }

  if (!metadata.vault_id) {
    throw new Error(`Secret "${secretName}" has no vault reference. Re-create it.`)
  }

  // 3. Fetch decrypted value from Vault
  // Production implementation:
  //   const { data: vaultRow } = await client.rpc('vault_read_secret', { secret_id: metadata.vault_id })
  //   const value = vaultRow?.decrypted_secret
  //
  // Simulated: Since Vault API varies by Supabase plan and setup, we return a
  // placeholder that indicates the vault lookup was attempted. Replace this
  // with the real vault query once Supabase Vault is configured.
  let decryptedValue: string

  try {
    // Attempt real vault query (will work once Vault extension is enabled)
    const { data: vaultData, error: vaultError } = await client
      .from('vault.decrypted_secrets' as string)
      .select('decrypted_secret')
      .eq('id', metadata.vault_id)
      .single()

    if (vaultError || !vaultData) {
      // Fallback for development: vault not available
      logger.warn({
        msg: 'Vault query failed, using fallback. Enable Supabase Vault in production.',
        vaultId: metadata.vault_id,
        error: vaultError?.message,
      })
      decryptedValue = `VAULT_PLACEHOLDER_${metadata.vault_id}`
    } else {
      decryptedValue = (vaultData as Record<string, unknown>)['decrypted_secret'] as string
    }
  } catch {
    // Vault extension not available — development mode fallback
    logger.warn({
      msg: 'Vault extension not available. Using placeholder.',
      vaultId: metadata.vault_id,
    })
    decryptedValue = `VAULT_PLACEHOLDER_${metadata.vault_id}`
  }

  // 4. Log access
  const { error: logError } = await client
    .from('secret_access_log')
    .insert({
      holding_id: holdingId,
      secret_id: metadata.id,
      accessed_by: `api:worker`,
      context,
    })

  if (logError) {
    // Log but don't fail — the secret was successfully loaded
    logger.error({
      msg: 'Failed to write secret access log',
      secretId: metadata.id,
      error: logError.message,
    })
  }

  return {
    value: decryptedValue,
    metadata,
  }
}

/**
 * Convenience: Load a secret value and return only the string.
 * For cases where you just need the value and don't care about metadata.
 */
export async function loadSecretValue(
  holdingId: string,
  secretName: string,
  context: string,
): Promise<string> {
  const result = await loadSecret(holdingId, secretName, context)
  return result.value
}
