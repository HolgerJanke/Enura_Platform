export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type RouteContext = {
  params: {
    locationKey: string
  }
}

/**
 * Help snippet — small contextual help text bound to a specific UI location.
 *
 * Stored in the `help_snippets` table:
 *   location_key  TEXT  — e.g. "setter.kpi.reach_rate"
 *   locale        TEXT  — e.g. "de"
 *   title         TEXT
 *   content       TEXT  — markdown
 *   article_slug  TEXT  — optional link to full article
 *   article_level TEXT  — optional, e.g. "company"
 *
 * Falls back to locale "de" if the requested locale is not found.
 */
export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { locationKey } = params
  const locale = request.headers.get('x-locale') ?? 'de'
  const supabase = createSupabaseServerClient()

  // Try requested locale first
  const { data: snippet, error } = await supabase
    .from('help_snippets')
    .select('location_key, locale, title, content, article_slug, article_level')
    .eq('location_key', locationKey)
    .eq('locale', locale)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: 'Snippet konnte nicht geladen werden.' },
      { status: 500 },
    )
  }

  if (snippet) {
    return NextResponse.json({ data: snippet })
  }

  // Fallback to "de"
  if (locale !== 'de') {
    const { data: fallback, error: fbError } = await supabase
      .from('help_snippets')
      .select('location_key, locale, title, content, article_slug, article_level')
      .eq('location_key', locationKey)
      .eq('locale', 'de')
      .maybeSingle()

    if (fbError) {
      return NextResponse.json(
        { error: 'Snippet konnte nicht geladen werden.' },
        { status: 500 },
      )
    }

    if (fallback) {
      return NextResponse.json({ data: fallback })
    }
  }

  return NextResponse.json(
    { error: 'Snippet nicht gefunden.' },
    { status: 404 },
  )
}
