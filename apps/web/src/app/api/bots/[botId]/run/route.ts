import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
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

  const session = await getSession()
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { input } = body as {
      input: Record<string, unknown>
    }

    if (!input) {
      return NextResponse.json(
        { error: 'input ist pflicht.' },
        { status: 400 },
      )
    }

    // Tenant scope comes from the verified session, never client input.
    const result = await runBot(botId, { companyId: session.companyId, input })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Interner Fehler'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
