import OpenAI from 'openai'
import { type Uploadable } from 'openai/uploads'

let client: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        '[transcription] OPENAI_API_KEY is not set. Cannot initialise client.',
      )
    }
    client = new OpenAI({ apiKey })
  }
  return client
}

/**
 * Domain-specific vocabulary hints for Whisper.
 * These improve recognition of PV / renewable energy terminology
 * and Swiss German business vocabulary.
 */
const DEFAULT_VOCABULARY_HINT = [
  'Photovoltaik',
  'PV-Anlage',
  'Solaranlage',
  'Wärmepumpe',
  'Wechselrichter',
  'Eigenverbrauch',
  'Einspeisung',
  'Kilowatt-Peak',
  'kWp',
  'kWh',
  'Stromspeicher',
  'Batteriespeicher',
  'Solarpanel',
  'Aufdach',
  'Indach',
  'Flachdach',
  'Schrägdach',
  'Montage',
  'Installateur',
  'Reonic',
  'Bexio',
  'Alpen Energie',
  'Beratungstermin',
  'Terminvereinbarung',
  'Setter',
  'Berater',
  'Innendienst',
  'Geschäftsführung',
  'Offerte',
  'Abschluss',
  'Interessent',
].join(', ')

export interface TranscriptionResult {
  /** Full transcript text. */
  text: string
  /** Detected language code (e.g. "de"). */
  language: string
  /** Duration of the audio in milliseconds, if available from metadata. */
  durationMs: number | null
}

interface TranscribeOptions {
  /** Additional vocabulary hints appended to the default list. */
  hints?: string[]
}

/**
 * Transcribes an audio buffer using OpenAI Whisper.
 *
 * @param audioBuffer  Raw audio file bytes (mp3, wav, m4a, etc.)
 * @param filename     Original filename including extension (used for format detection).
 * @param options      Optional vocabulary hints.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  options?: TranscribeOptions,
): Promise<TranscriptionResult> {
  const openai = getOpenAIClient()

  const prompt =
    options?.hints && options.hints.length > 0
      ? `${DEFAULT_VOCABULARY_HINT}, ${options.hints.join(', ')}`
      : DEFAULT_VOCABULARY_HINT

  // Create a File-like object from the buffer for the OpenAI SDK
  const blob = new Blob([audioBuffer as unknown as ArrayBuffer], { type: mimeTypeFromFilename(filename) })
  const file = new File([blob], filename, {
    type: mimeTypeFromFilename(filename),
  }) as Uploadable

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'de',
    prompt,
    response_format: 'verbose_json',
  })

  // The verbose_json format returns duration and language metadata
  const verboseResponse = response as unknown as {
    text: string
    language: string
    duration?: number
  }

  return {
    text: verboseResponse.text,
    language: verboseResponse.language ?? 'de',
    durationMs: verboseResponse.duration
      ? Math.round(verboseResponse.duration * 1000)
      : null,
  }
}

/**
 * Derives a MIME type from the filename extension.
 */
function mimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'm4a':
      return 'audio/m4a'
    case 'ogg':
      return 'audio/ogg'
    case 'webm':
      return 'audio/webm'
    case 'flac':
      return 'audio/flac'
    default:
      return 'audio/mpeg'
  }
}
