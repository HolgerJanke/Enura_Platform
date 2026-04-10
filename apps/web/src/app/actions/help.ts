'use server'

import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Tour progress
// ---------------------------------------------------------------------------

type SaveTourProgressParams = {
  tourId: string
  step: number
  skipped?: boolean
}

/**
 * Saves onboarding tour progress for the current user.
 *
 * Upserts into `tour_progress` table:
 *   profile_id  UUID
 *   tour_id     TEXT
 *   step        INT
 *   skipped     BOOLEAN
 *   updated_at  TIMESTAMPTZ
 */
export async function saveTourProgress({
  tourId,
  step,
  skipped = false,
}: SaveTourProgressParams): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Nicht authentifiziert.' }
  }

  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from('tour_progress')
    .upsert(
      {
        profile_id: session.profile.id,
        tour_id: tourId,
        step,
        skipped,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,tour_id' },
    )

  if (error) {
    return { success: false, error: 'Tour-Fortschritt konnte nicht gespeichert werden.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// Snippet fetcher (server action variant)
// ---------------------------------------------------------------------------

type SnippetResult = {
  title: string
  content: string
  article_slug: string | null
  article_level: string | null
} | null

/**
 * Fetches a help snippet by location_key for the current locale.
 * Falls back to "de" if the requested locale is not found.
 *
 * Can be called from server components or via useTransition in client components.
 */
export async function fetchSnippet(
  locationKey: string,
  locale: string = 'de',
): Promise<{ data: SnippetResult; error?: string }> {
  const session = await getSession()
  if (!session) {
    return { data: null, error: 'Nicht authentifiziert.' }
  }

  const supabase = createSupabaseServerClient()

  // Try requested locale
  const { data: snippet, error } = await supabase
    .from('help_snippets')
    .select('title, content, article_slug, article_level')
    .eq('location_key', locationKey)
    .eq('locale', locale)
    .maybeSingle()

  if (error) {
    return { data: null, error: 'Snippet konnte nicht geladen werden.' }
  }

  if (snippet) {
    return {
      data: snippet as SnippetResult,
    }
  }

  // Fallback to "de"
  if (locale !== 'de') {
    const { data: fallback, error: fbError } = await supabase
      .from('help_snippets')
      .select('title, content, article_slug, article_level')
      .eq('location_key', locationKey)
      .eq('locale', 'de')
      .maybeSingle()

    if (fbError) {
      return { data: null, error: 'Snippet konnte nicht geladen werden.' }
    }

    return { data: (fallback as SnippetResult) ?? null }
  }

  return { data: null }
}
