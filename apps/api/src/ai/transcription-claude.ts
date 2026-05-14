/**
 * Audio transcription using Claude's native audio understanding.
 * Fallback for when OPENAI_API_KEY (Whisper) is not available.
 */
import { getAnthropicClient } from '../lib/ai/anthropic.js'

export interface TranscriptionResult {
  text: string
  language: string
  durationMs: number | null
}

/**
 * Transcribes an audio buffer using Claude's audio input capability.
 * Supports wav, mp3, m4a, ogg, webm formats.
 */
export async function transcribeWithClaude(
  audioBuffer: Buffer,
  filename: string,
): Promise<TranscriptionResult> {
  const anthropic = getAnthropicClient()
  const mediaType = mimeFromFilename(filename) as
    | 'audio/wav'
    | 'audio/mpeg'
    | 'audio/ogg'
    | 'audio/webm'

  const base64Audio = audioBuffer.toString('base64')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Transkribiere dieses Telefongespräch vollständig auf Deutsch (Hochdeutsch). Gib nur das Transkript aus, ohne Einleitung oder Kommentare. Wenn Schweizerdeutsch gesprochen wird, übertrage es in Hochdeutsch. Kennzeichne verschiedene Sprecher mit "Setter:" und "Kunde:" wenn möglich.',
          },
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Audio,
            },
          } as any,
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''

  return {
    text,
    language: 'de',
    durationMs: null,
  }
}

function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'mp3': return 'audio/mpeg'
    case 'wav': return 'audio/wav'
    case 'ogg': return 'audio/ogg'
    case 'webm': return 'audio/webm'
    case 'm4a': return 'audio/mp4'
    default: return 'audio/wav'
  }
}
