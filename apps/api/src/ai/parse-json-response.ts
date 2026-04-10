import { type ZodSchema, type ZodError } from 'zod'

/**
 * Parses a JSON response from Claude, handling common formatting issues.
 *
 * Claude sometimes wraps JSON in markdown code fences. This function:
 * 1. Strips ```json ... ``` or ``` ... ``` wrappers if present.
 * 2. Parses the raw JSON.
 * 3. Validates against the provided Zod schema.
 * 4. Returns the typed result or throws a descriptive error.
 */
export function parseJsonResponse<T>(raw: string, schema: ZodSchema<T>): T {
  const stripped = stripCodeFences(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    throw new Error(
      `[parse-json-response] Failed to parse JSON from Claude response.\n` +
        `Raw (first 500 chars): ${raw.slice(0, 500)}`,
    )
  }

  const result = schema.safeParse(parsed)

  if (!result.success) {
    const issues = formatZodError(result.error)
    throw new Error(
      `[parse-json-response] Claude response JSON did not match expected schema.\n` +
        `Validation errors:\n${issues}\n` +
        `Parsed JSON (first 500 chars): ${JSON.stringify(parsed).slice(0, 500)}`,
    )
  }

  return result.data
}

/**
 * Removes markdown code fences from a string.
 * Handles ```json\n...\n```, ```\n...\n```, and no-fence cases.
 */
function stripCodeFences(text: string): string {
  let trimmed = text.trim()

  // Match opening fence with optional language tag
  const openFenceRe = /^```(?:json|JSON)?\s*\n?/
  const closeFenceRe = /\n?\s*```\s*$/

  if (openFenceRe.test(trimmed) && closeFenceRe.test(trimmed)) {
    trimmed = trimmed.replace(openFenceRe, '').replace(closeFenceRe, '')
  }

  return trimmed.trim()
}

/**
 * Formats a ZodError into a human-readable string for error messages.
 */
function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      return `  - ${path}: ${issue.message}`
    })
    .join('\n')
}
