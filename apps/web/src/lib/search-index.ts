// =============================================================================
// Search Index — flexsearch-based full-text search over help articles
// =============================================================================

import FlexSearch from 'flexsearch';
import { getAllArticleSlugs, getArticle } from './content';
import type { Article, ContentLevel, SupportedLocale } from './content';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  slug: string;
  level: ContentLevel;
  locale: SupportedLocale;
  title: string;
  excerpt: string;
  score: number;
}

interface IndexEntry {
  id: number;
  slug: string;
  level: ContentLevel;
  locale: SupportedLocale;
  title: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Index cache (per locale)
// ---------------------------------------------------------------------------

const indexCache = new Map<string, {
  index: FlexSearch.Index;
  entries: Map<number, IndexEntry>;
}>();

// ---------------------------------------------------------------------------
// buildIndex — populates the flexsearch index for given levels + locale
// ---------------------------------------------------------------------------

async function buildIndex(
  levels: ContentLevel[],
  locale: SupportedLocale,
): Promise<{ index: FlexSearch.Index; entries: Map<number, IndexEntry> }> {
  const cacheKey = `${levels.sort().join(',')}:${locale}`;
  const cached = indexCache.get(cacheKey);
  if (cached) return cached;

  const index = new FlexSearch.Index({
    tokenize: 'forward',
    resolution: 9,
  });

  const entries = new Map<number, IndexEntry>();
  let nextId = 0;

  for (const level of levels) {
    const slugs = await getAllArticleSlugs(level, locale);

    for (const slug of slugs) {
      const article: Article | null = await getArticle(level, locale, slug);
      if (!article) continue;

      const id = nextId++;
      const entry: IndexEntry = {
        id,
        slug: article.slug,
        level: article.level,
        locale: article.locale,
        title: article.frontmatter.title,
        content: article.content,
      };

      entries.set(id, entry);
      // Index both title (boosted by repetition) and content
      index.add(id, `${entry.title} ${entry.title} ${entry.content}`);
    }
  }

  const result = { index, entries };
  indexCache.set(cacheKey, result);
  return result;
}

// ---------------------------------------------------------------------------
// searchArticles — returns ranked results with excerpts
// ---------------------------------------------------------------------------

export async function searchArticles(
  query: string,
  levels: ContentLevel[],
  locale: SupportedLocale,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const { index, entries } = await buildIndex(levels, locale);
  const rawResults = index.search(query, { limit: 20 });

  const results: SearchResult[] = [];

  for (let rank = 0; rank < rawResults.length; rank++) {
    const id = rawResults[rank] as number;
    const entry = entries.get(id);
    if (!entry) continue;

    results.push({
      slug: entry.slug,
      level: entry.level,
      locale: entry.locale,
      title: entry.title,
      excerpt: buildExcerpt(entry.content, query),
      score: 1 - rank / rawResults.length,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// buildExcerpt — extracts a ~150-char window around the first query match
// ---------------------------------------------------------------------------

function buildExcerpt(content: string, query: string): string {
  const EXCERPT_LENGTH = 150;
  const plain = content
    .replace(/^---[\s\S]*?---/, '')  // strip frontmatter remnants
    .replace(/[#*`>\[\]()!]/g, '')   // strip markdown syntax
    .replace(/\s+/g, ' ')
    .trim();

  const lowerPlain = plain.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const pos = lowerPlain.indexOf(lowerQuery);

  if (pos === -1) {
    return plain.slice(0, EXCERPT_LENGTH) + (plain.length > EXCERPT_LENGTH ? '...' : '');
  }

  const start = Math.max(0, pos - 60);
  const end = Math.min(plain.length, pos + query.length + 90);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < plain.length ? '...' : '';

  return `${prefix}${plain.slice(start, end)}${suffix}`;
}

// ---------------------------------------------------------------------------
// clearSearchCache — useful for testing or after content updates
// ---------------------------------------------------------------------------

export function clearSearchCache(): void {
  indexCache.clear();
}
