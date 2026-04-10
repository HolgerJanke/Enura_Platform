import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6' as const

let client: Anthropic | null = null

/**
 * Returns a singleton Anthropic client instance.
 * The SDK reads ANTHROPIC_API_KEY from the environment automatically.
 */
export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        '[anthropic] ANTHROPIC_API_KEY is not set. Cannot initialise client.',
      )
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

interface CallClaudeParams {
  systemPrompt: string
  userMessage: string
  maxTokens?: number
  temperature?: number
}

/**
 * Sends a message to Claude and returns the text response.
 * Always uses claude-sonnet-4-6 as specified in the platform guidelines.
 */
export async function callClaude({
  systemPrompt,
  userMessage,
  maxTokens = 2000,
  temperature = 0.3,
}: CallClaudeParams): Promise<string> {
  const anthropic = getAnthropicClient()

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')

  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(
      '[anthropic] Claude response contained no text block. ' +
        `Stop reason: ${response.stop_reason}`,
    )
  }

  return textBlock.text
}
