import { createClient } from '@supabase/supabase-js'
import { ConnectorAuthError } from '../base.js'
import type { ConnectorConfig } from '../base.js'
import {
  BexioCredentialsSchema,
  BexioOAuthCredentialsSchema,
  type BexioCredentials,
  type BexioOAuthCredentials,
} from './schemas.js'

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
 * Check whether the current OAuth access token has expired (with a 60s buffer).
 * Only meaningful for OAuth credentials — PAT credentials are not refreshed
 * here (their lifetime is managed by the user in Bexio's UI).
 */
function isTokenExpired(credentials: BexioOAuthCredentials): boolean {
  const expiresAt = new Date(credentials.expires_at).getTime()
  const bufferMs = 60_000
  return Date.now() >= expiresAt - bufferMs
}

/**
 * Returns true if the stored credentials only carry an `access_token`
 * (PAT mode) and lack the OAuth refresh fields.
 */
function isPATCredentials(credentials: BexioCredentials): boolean {
  return (
    !credentials.client_id ||
    !credentials.client_secret ||
    !credentials.refresh_token
  )
}

/**
 * Refresh the Bexio OAuth2 access token and persist the new tokens
 * to the connector's credentials column.
 */
export async function refreshBexioToken(
  connector: ConnectorConfig,
  credentials: BexioOAuthCredentials,
): Promise<BexioOAuthCredentials> {
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

  const updatedCredentials: BexioOAuthCredentials = {
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
 * Returns a valid Bexio access token.
 *
 * - PAT mode: returns the stored access_token directly (no refresh).
 *   The token's lifetime is managed by the user in Bexio's UI; if it
 *   expires, downstream API calls will surface 401/403 errors which
 *   become ConnectorAuthError and prompt the user to rotate the token.
 *
 * - OAuth mode: refreshes the token first if it has expired.
 */
export async function getBexioAccessToken(connector: ConnectorConfig): Promise<string> {
  const credentials = parseCredentials(connector)

  // PAT mode — no refresh, use the access_token as-is.
  if (isPATCredentials(credentials)) {
    return credentials.access_token
  }

  // OAuth mode — narrow to the strict schema (all fields required) and
  // refresh if the access token is expiring.
  const oauthResult = BexioOAuthCredentialsSchema.safeParse(credentials)
  if (!oauthResult.success) {
    // Partial OAuth credentials — fall back to using access_token as-is.
    return credentials.access_token
  }

  if (!isTokenExpired(oauthResult.data)) {
    return oauthResult.data.access_token
  }

  const refreshed = await refreshBexioToken(connector, oauthResult.data)
  return refreshed.access_token
}
