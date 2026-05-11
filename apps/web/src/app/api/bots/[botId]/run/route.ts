import { NextRequest, NextResponse } from 'next/server'
import { runBot } from '@/lib/bot-client'

/**
 * POST /api/bots/:botId/run
 * Proxy route that forwards the request to the Bot API.
 * This avoids CORS issues when the client component calls the bot API.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params

  try {
    const body = await request.json()
    const { companyId, input } = body as {
      companyId: string
      input: Record<string, unknown>
    }

    if (!companyId || !input) {
      return NextResponse.json(
        { error: 'companyId und input sind pflicht.' },
        { status: 400 },
      )
    }

    const result = await runBot(botId, { companyId, input })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Interner Fehler'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
