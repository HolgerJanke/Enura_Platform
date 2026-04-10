import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROMPT_NAMES = [
  'call-analysis',
  'call-analysis-system',
  'daily-report',
  'daily-report-system',
  'script-check',
  'invoice-extraction',
  'invoice-extraction-system',
] as const

export type PromptName = (typeof PROMPT_NAMES)[number]

const cache = new Map<PromptName, string>()

const promptsDir = dirname(fileURLToPath(import.meta.url))

/**
 * Loads a prompt .md file by name from the prompts directory.
 * Results are cached in memory after the first load.
 */
export async function loadPrompt(name: PromptName): Promise<string> {
  const cached = cache.get(name)
  if (cached) return cached

  if (!PROMPT_NAMES.includes(name)) {
    throw new Error(`[prompt-loader] Unknown prompt name: "${name}"`)
  }

  const filePath = join(promptsDir, `${name}.md`)

  try {
    const content = await readFile(filePath, 'utf-8')
    cache.set(name, content)
    return content
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `[prompt-loader] Failed to load prompt "${name}" from ${filePath}: ${message}`,
    )
  }
}

/**
 * Pre-loads all prompts into the cache.
 * Call during server startup to fail fast if any file is missing.
 */
export async function preloadAllPrompts(): Promise<void> {
  await Promise.all(PROMPT_NAMES.map((name) => loadPrompt(name)))
}

/**
 * Clears the prompt cache. Useful for tests.
 */
export function clearPromptCache(): void {
  cache.clear()
}
