// =============================================================================
// Response Validator — Validates API response data against response_schema JSONB
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SchemaProperty {
  type?: string
  required?: boolean
  items?: SchemaProperty
  properties?: Record<string, SchemaProperty>
  enum?: unknown[]
  [key: string]: unknown
}

interface ResponseSchemaDefinition {
  type?: string
  properties?: Record<string, SchemaProperty>
  required?: string[]
  [key: string]: unknown
}

interface ValidationError {
  path: string
  message: string
}

// ---------------------------------------------------------------------------
// Type checking helpers
// ---------------------------------------------------------------------------

function getJsonType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function isSchemaProperty(value: unknown): value is SchemaProperty {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ---------------------------------------------------------------------------
// Recursive validator
// ---------------------------------------------------------------------------

function validateValue(
  value: unknown,
  schema: SchemaProperty,
  path: string,
  errors: ValidationError[],
): void {
  if (value === undefined || value === null) {
    if (schema.required === true) {
      errors.push({ path, message: `Required field is missing or null.` })
    }
    return
  }

  // Type check
  if (schema.type) {
    const actualType = getJsonType(value)
    const expectedType = schema.type

    // Allow numeric strings for "number" / "integer" types
    if (
      (expectedType === 'number' || expectedType === 'integer') &&
      actualType === 'string' &&
      !isNaN(Number(value))
    ) {
      // Acceptable — many APIs return numbers as strings
    } else if (expectedType === 'array' && actualType !== 'array') {
      errors.push({
        path,
        message: `Expected array but got ${actualType}.`,
      })
      return
    } else if (expectedType === 'object' && actualType !== 'object') {
      errors.push({
        path,
        message: `Expected object but got ${actualType}.`,
      })
      return
    } else if (
      expectedType === 'string' &&
      actualType !== 'string'
    ) {
      errors.push({
        path,
        message: `Expected string but got ${actualType}.`,
      })
      return
    } else if (
      expectedType === 'boolean' &&
      actualType !== 'boolean'
    ) {
      errors.push({
        path,
        message: `Expected boolean but got ${actualType}.`,
      })
      return
    }
  }

  // Enum check
  if (schema.enum && Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      errors.push({
        path,
        message: `Value "${String(value)}" is not in allowed values: [${schema.enum.map(String).join(', ')}].`,
      })
    }
  }

  // Nested object properties
  if (schema.type === 'object' && schema.properties && isSchemaProperty(value)) {
    const obj = value as Record<string, unknown>
    const requiredFields = new Set(
      Array.isArray(schema.required) ? (schema.required as string[]) : [],
    )

    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const childValue = obj[propName]
      const childPath = path ? `${path}.${propName}` : propName
      const effectiveSchema: SchemaProperty = {
        ...propSchema,
        required: propSchema.required === true || requiredFields.has(propName),
      }
      validateValue(childValue, effectiveSchema, childPath, errors)
    }
  }

  // Array items
  if (schema.type === 'array' && schema.items && Array.isArray(value)) {
    const arr = value as unknown[]
    for (let i = 0; i < arr.length; i++) {
      validateValue(arr[i], schema.items, `${path}[${i}]`, errors)
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates response data against a response_schema JSONB definition.
 *
 * Throws a descriptive error if validation fails, listing all violations.
 *
 * @param data - The parsed response data to validate
 * @param schema - The response_schema JSONB from the interface config
 */
export function validateResponseSchema(
  data: unknown,
  schema: Record<string, unknown>,
): void {
  const errors: ValidationError[] = []
  const schemaDef = schema as unknown as ResponseSchemaDefinition

  validateValue(data, schemaDef as unknown as SchemaProperty, '', errors)

  // Check top-level required fields
  if (schemaDef.required && Array.isArray(schemaDef.required) && isSchemaProperty(data)) {
    const obj = data as Record<string, unknown>
    for (const field of schemaDef.required) {
      if (obj[field] === undefined || obj[field] === null) {
        const alreadyReported = errors.some((e) => e.path === field)
        if (!alreadyReported) {
          errors.push({
            path: field,
            message: `Required top-level field is missing.`,
          })
        }
      }
    }
  }

  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.path || '(root)'}: ${e.message}`)
      .join('\n')
    throw new Error(
      `Response schema validation failed with ${errors.length} error(s):\n${details}`,
    )
  }
}
