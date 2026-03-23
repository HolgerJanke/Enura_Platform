import { createClient } from '@supabase/supabase-js'
import { ConnectorAuthError } from '../base.js'
import type { ConnectorConfig } from '../base.js'
import { BexioCredentialsSchema, type BexioCredentials } from './schemas.js'

const BEXIO_TOKEN_URL = 'https://idp.bexio.com/token'

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Parse and validate stored Bexio credentials from connector config.
 */
function parseCredentials(connector: ConnectorConfig): BexioCredentials {
  const result = BexioCredentialsSchema.safeParse(connector.credentials)
  if (!result.success) {
    throw new ConnectorAuthError(
      `Invalid Bexio credentials for connector ${connector.id}: ${result.error.message}`,
    )
  }
  return result.data
}

/**
 * Check whether the current access token has expired (with a 60s buffer).
 */
function isTokenExpired(credentials: BexioCredentials): boolean {
  const expiresAt = new Date(credentials.expires_at).getTime()
  const bufferMs = 60_000
  return Date.now() >= expiresAt - bufferMs
}

/**
 * Refresh the Bexio OAuth2 access token and persist the new tokens
 * to the connector's credentials column.
 */
export async function refreshBexioToken(
  connector: ConnectorConfig,
  credentials: BexioCredentials,
): Promise<BexioCredentials> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    refresh_token: credentials.refresh_token,
  })

  const response = await fetch(BEXIO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ConnectorAuthError(
      `Bexio token refresh failed (${response.status}): ${errorText}`,
    )
  }

  const tokenData = (await response.json()) as Record<string, unknown>

  const expiresIn = typeof tokenData['expires_in'] === 'number'
    ? tokenData['expires_in']
    : 3600
  const expiresAt = new Date(Date.now() + (expiresIn as number) * 1000).toISOString()

  const newAccessToken = tokenData['access_token']
  const newRefreshToken = tokenData['refresh_token']

  if (typeof newAccessToken !== 'string' || typeof newRefreshToken !== 'string') {
    throw new ConnectorAuthError('Bexio token response missing access_token or refresh_token')
  }

  const updatedCredentials: BexioCredentials = {
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    expires_at: expiresAt,
  }

  const db = getServiceClient()
  const { error } = await db
    .from('connectors')
    .update({ credentials: updatedCredentials as unknown as Record<string, unknown> })
    .eq('id', connector.id)

  if (error) {
    throw new ConnectorAuthError(`Failed to persist refreshed Bexio tokens: ${error.message}`)
  }

  return updatedCredentials
}

/**
 * Returns a valid Bexio access token, refreshing it first if it has expired.
 */
export async function getBexioAccessToken(connector: ConnectorConfig): Promise<string> {
  const credentials = parseCredentials(connector)

  if (!isTokenExpired(credentials)) {
    return credentials.access_token
  }

  const refreshed = await refreshBexioToken(connector, credentials)
  return refreshed.access_token
}
