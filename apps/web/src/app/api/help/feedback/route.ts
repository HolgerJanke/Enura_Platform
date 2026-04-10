import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type FeedbackBody = {
  articleSlug: string
  articleLevel: string
  rating: 'positive' | 'negative'
}

/**
 * POST /api/help/feedback
 *
 * Records user feedback on a help article.
 * Inserts into the `help_feedback` table.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 })
  }

  let body: FeedbackBody
  try {
    body = (await request.json()) as FeedbackBody
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 })
  }

  const { articleSlug, articleLevel, rating } = body

  if (!articleSlug || !articleLevel || !['positive', 'negative'].includes(rating)) {
    return NextResponse.json(
      { error: 'articleSlug, articleLevel und rating (positive/negative) sind erforderlich.' },
      { status: 400 },
    )
  }

  const supabase = createSupabaseServerClient()

  const { error } = await supabase.from('help_feedback').insert({
    profile_id: session.profile.id,
    article_slug: articleSlug,
    article_level: articleLevel,
    rating,
  })

  if (error) {
    return NextResponse.json(
      { error: 'Feedback konnte nicht gespeichert werden.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: { success: true } })
}
