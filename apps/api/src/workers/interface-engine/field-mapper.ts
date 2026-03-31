// =============================================================================
// Field Mapper — Extracts values from API responses and writes to target tables
// =============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../../lib/logger.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldMappingEntry {
  source_path: string
  target_table: string
  target_column: string
  transform?: string | null
  filter_column?: string | null
  filter_value?: string | null
}

export interface FieldMappingResult {
  table: string
  column: string
  value: unknown
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Service client
// ---------------------------------------------------------------------------

let _serviceClient: SupabaseClient | null = null

function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient

  _serviceClient = createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  return _serviceClient
}

// ---------------------------------------------------------------------------
// Dot-notation path extraction (supports nested objects + array indices)
// ---------------------------------------------------------------------------

/**
 * Extracts a value from a nested object using dot-notation path.
 *
 * Supports:
 *   - Simple paths: "status" => data.status
 *   - Nested paths: "project.details.phase" => data.project.details.phase
 *   - Array indices: "items.0.name" => data.items[0].name
 *   - Mixed: "results.data.0.attributes.status"
 *
 * Returns undefined if the path does not resolve.
 */
export function extractByPath(data: unknown, path: string): unknown {
  const segments = path.split('.')
  let current: unknown = data

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined
    }

    // Check if segment is a numeric index
    const index = parseInt(segment, 10)

    if (!isNaN(index) && Array.isArray(current)) {
      current = current[index]
    } else if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[segment]
    } else {
      return undefined
    }
  }

  return current
}

// ---------------------------------------------------------------------------
// Transformation functions
// ---------------------------------------------------------------------------

/**
 * Applies a transformation to a raw value.
 *
 * Supported transforms:
 *   - "mapping:won->7"       Maps string value to another (e.g. status code)
 *   - "date_iso"             Converts to ISO 8601 date string
 *   - "numeric"              Parses to number
 *   - "first_array_element"  Takes the first element of an array
 */
export function applyTransform(
  value: unknown,
  transform: string,
): unknown {
  // mapping:source_value->target_value
  if (transform.startsWith('mapping:')) {
    const mappingDef = transform.slice('mapping:'.length)
    const pairs = mappingDef.split(',')
    const mappings = new Map<string, string>()

    for (const pair of pairs) {
      const arrowIndex = pair.indexOf('->')
      if (arrowIndex === -1) continue
      const from = pair.slice(0, arrowIndex).trim()
      const to = pair.slice(arrowIndex + 2).trim()
      mappings.set(from, to)
    }

    const strValue = String(value)
    const mapped = mappings.get(strValue)
    if (mapped !== undefined) {
      // Try to return as number if it looks numeric
      const asNum = Number(mapped)
      return isNaN(asNum) ? mapped : asNum
    }
    return value
  }

  // date_iso — convert to ISO date string
  if (transform === 'date_iso') {
    if (value === null || value === undefined) return null
    const date = new Date(String(value))
    if (isNaN(date.getTime())) {
      throw new Error(`Cannot convert "${String(value)}" to ISO date.`)
    }
    return date.toISOString()
  }

  // numeric — parse to number
  if (transform === 'numeric') {
    if (value === null || value === undefined) return null
    const num = Number(value)
    if (isNaN(num)) {
      throw new Error(`Cannot convert "${String(value)}" to number.`)
    }
    return num
  }

  // first_array_element — take first item from array
  if (transform === 'first_array_element') {
    if (Array.isArray(value)) {
      return value.length > 0 ? value[0] : null
    }
    return value
  }

  throw new Error(`Unknown transform: "${transform}"`)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads field_mapping array from an interface definition, extracts values from
 * the API response, applies transformations, and writes results to target tables.
 *
 * @param responseData - The parsed API response
 * @param fieldMappings - Array of field mapping definitions from the interface
 * @param companyId - The tenant's company_id for scoping updates
 * @returns Array describing what was written (or failed)
 */
export async function applyFieldMapping(
  responseData: unknown,
  fieldMappings: Record<string, unknown>[],
  companyId: string,
): Promise<FieldMappingResult[]> {
  const client = getServiceClient()
  const results: FieldMappingResult[] = []

  for (const rawMapping of fieldMappings) {
    const mapping = rawMapping as unknown as FieldMappingEntry

    if (!mapping.source_path || !mapping.target_table || !mapping.target_column) {
      results.push({
        table: mapping.target_table ?? 'unknown',
        column: mapping.target_column ?? 'unknown',
        value: null,
        success: false,
        error: 'Incomplete field mapping definition: source_path, target_table, and target_column are required.',
      })
      continue
    }

    // 1. Extract value from response
    let value = extractByPath(responseData, mapping.source_path)

    // 2. Apply transform if specified
    if (mapping.transform) {
      try {
        value = applyTransform(value, mapping.transform)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        results.push({
          table: mapping.target_table,
          column: mapping.target_column,
          value,
          success: false,
          error: `Transform "${mapping.transform}" failed: ${errMsg}`,
        })
        continue
      }
    }

    // 3. Write to target table with filter conditions
    try {
      let query = client
        .from(mapping.target_table)
        .update({ [mapping.target_column]: value })
        .eq('company_id', companyId)

      // Apply additional filter if specified
      if (mapping.filter_column && mapping.filter_value !== undefined && mapping.filter_value !== null) {
        query = query.eq(mapping.filter_column, mapping.filter_value)
      }

      const { error } = await query

      if (error) {
        logger.error({
          msg: 'Field mapping write failed',
          table: mapping.target_table,
          column: mapping.target_column,
          error: error.message,
        })
        results.push({
          table: mapping.target_table,
          column: mapping.target_column,
          value,
          success: false,
          error: error.message,
        })
      } else {
        results.push({
          table: mapping.target_table,
          column: mapping.target_column,
          value,
          success: true,
        })
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      results.push({
        table: mapping.target_table,
        column: mapping.target_column,
        value,
        success: false,
        error: errMsg,
      })
    }
  }

  return results
}
