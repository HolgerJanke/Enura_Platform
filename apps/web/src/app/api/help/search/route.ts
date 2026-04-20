export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import Fuse from 'fuse.js'
import { HELP_ARTICLES } from '@/app/help/data'
import type { HelpArticle } from '@/app/help/data'

type SearchResult = {
  title: string
  slug: string
  level: string
  excerpt: string
}

/** Fuse.js index built once per cold start. */
const fuse = new Fuse<HelpArticle>(HELP_ARTICLES, {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'excerpt', weight: 0.3 },
    { name: 'tags', weight: 0.3 },
  ],
  threshold: 0.4,
  includeScore: true,
})

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') ?? ''
  const levelsParam = searchParams.get('levels') ?? 'company'
  const allowedLevels = new Set(levelsParam.split(',').filter(Boolean))

  if (query.trim().length < 2) {
    return NextResponse.json({ data: [] })
  }

  const results = fuse.search(query, { limit: 20 })

  const filtered: SearchResult[] = results
    .filter((r) => allowedLevels.has(r.item.level))
    .slice(0, 10)
    .map((r) => ({
      title: r.item.title,
      slug: r.item.slug,
      level: r.item.level,
      excerpt: r.item.excerpt,
    }))

  return NextResponse.json({ data: filtered })
}
