// =============================================================================
// Request Builder — Constructs HTTP requests from interface schema definitions
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuiltRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: Record<string, unknown> | null
}

interface SchemaProperty {
  type?: string
  'x-variable'?: string
  'x-default'?: unknown
  [key: string]: unknown
}

interface RequestSchemaDefinition {
  properties?: Record<string, SchemaProperty>
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Variable substitution in endpoint URLs
// ---------------------------------------------------------------------------

/**
 * Replaces `{variable}` placeholders in a URL template with values from context.
 *
 * Example:
 *   substituteUrl('/api/v1/leads/{leadId}/status', { leadId: '123' })
 *   => '/api/v1/leads/123/status'
 */
function substituteUrl(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(
    /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (_match, key: string) => {
      const value = variables[key]
      if (value === undefined) {
        throw new Error(`Missing URL variable: {${key}}`)
      }
      return encodeURIComponent(value)
    },
  )
}

// ---------------------------------------------------------------------------
// Auth header builder
// ---------------------------------------------------------------------------

function buildAuthHeaders(secretValue: string): Record<string, string> {
  return {
    Authorization: `Bearer ${secretValue}`,
  }
}

// ---------------------------------------------------------------------------
// Request body builder from schema with x-variable / x-default annotations
// ---------------------------------------------------------------------------

function buildBodyFromSchema(
  schema: RequestSchemaDefinition,
  variables: Record<string, string>,
): Record<string, unknown> {
  const properties = schema.properties
  if (!properties) return {}

  const body: Record<string, unknown> = {}

  for (const [key, prop] of Object.entries(properties)) {
    const variableRef = prop['x-variable']
    const defaultValue = prop['x-default']

    if (variableRef && variables[variableRef] !== undefined) {
      body[key] = variables[variableRef]
    } else if (defaultValue !== undefined) {
      body[key] = defaultValue
    }
    // If neither x-variable nor x-default, skip the field
  }

  return body
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a fully resolved HTTP request from an interface definition.
 *
 * @param endpoint - URL template with optional {variable} placeholders
 * @param httpMethod - HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param requestSchema - JSONB schema with x-variable and x-default annotations
 * @param secretValue - Decrypted secret for Bearer auth (null if no auth needed)
 * @param variables - Key-value pairs for URL and body variable substitution
 */
export function buildRequestFromSchema(opts: {
  endpoint: string
  httpMethod: string
  requestSchema: Record<string, unknown> | null
  secretValue: string | null
  variables: Record<string, string>
}): BuiltRequest {
  const { endpoint, httpMethod, requestSchema, secretValue, variables } = opts

  // 1. Substitute URL placeholders
  const url = substituteUrl(endpoint, variables)

  // 2. Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (secretValue) {
    Object.assign(headers, buildAuthHeaders(secretValue))
  }

  // 3. Build body (only for methods that support a body)
  const methodsWithBody = new Set(['POST', 'PUT', 'PATCH'])
  let body: Record<string, unknown> | null = null

  if (methodsWithBody.has(httpMethod.toUpperCase()) && requestSchema) {
    body = buildBodyFromSchema(
      requestSchema as RequestSchemaDefinition,
      variables,
    )
  }

  return {
    url,
    method: httpMethod.toUpperCase(),
    headers,
    body,
  }
}
