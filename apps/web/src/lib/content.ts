// =============================================================================
// Content Library — MDX Article Loader
// Reads MDX files with gray-matter frontmatter, supports locale fallback.
// =============================================================================

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContentLevel = 'platform' | 'holding' | 'company' | 'user';
export type SupportedLocale = 'de' | 'en' | 'fr' | 'it';

export interface ArticleFrontmatter {
  title: string;
  description: string;
  tags: string[];
  level: ContentLevel;
  locale: SupportedLocale;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface Article {
  slug: string;
  level: ContentLevel;
  locale: SupportedLocale;
  frontmatter: ArticleFrontmatter;
  content: string;
  readingTimeMinutes: number;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'help');

function levelDir(level: ContentLevel, locale: SupportedLocale): string {
  return path.join(CONTENT_ROOT, level, locale);
}

// ---------------------------------------------------------------------------
// getArticle — reads a single MDX file, with de fallback
// ---------------------------------------------------------------------------

export async function getArticle(
  level: ContentLevel,
  locale: SupportedLocale,
  slug: string,
): Promise<Article | null> {
  const filename = `${slug}.mdx`;

  // Try requested locale first
  let filePath = path.join(levelDir(level, locale), filename);

  if (!fs.existsSync(filePath)) {
    // Fallback to German
    if (locale !== 'de') {
      filePath = path.join(levelDir(level, 'de'), filename);
    }
    if (!fs.existsSync(filePath)) {
      return null;
    }
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const stats = readingTime(content);

  const frontmatter: ArticleFrontmatter = {
    title: (data.title as string) ?? slug,
    description: (data.description as string) ?? '',
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    level,
    locale: (data.locale as SupportedLocale) ?? locale,
    ...(data.updatedAt ? { updatedAt: String(data.updatedAt) } : {}),
  };

  return {
    slug,
    level,
    locale: frontmatter.locale,
    frontmatter,
    content,
    readingTimeMinutes: Math.ceil(stats.minutes),
  };
}

// ---------------------------------------------------------------------------
// getAllArticleSlugs — walks the directory tree for a given level + locale
// ---------------------------------------------------------------------------

export async function getAllArticleSlugs(
  level: ContentLevel,
  locale: SupportedLocale,
): Promise<string[]> {
  const slugs = new Set<string>();

  // Collect from requested locale
  collectSlugs(levelDir(level, locale), slugs);

  // Always include German as fallback source
  if (locale !== 'de') {
    collectSlugs(levelDir(level, 'de'), slugs);
  }

  return Array.from(slugs).sort();
}

function collectSlugs(dir: string, target: Set<string>): void {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.mdx')) {
      target.add(entry.name.replace(/\.mdx$/, ''));
    }
    if (entry.isDirectory()) {
      // Support nested directories — slug becomes subdir/filename
      const subDir = path.join(dir, entry.name);
      const subEntries = fs.readdirSync(subDir, { withFileTypes: true });
      for (const sub of subEntries) {
        if (sub.isFile() && sub.name.endsWith('.mdx')) {
          target.add(`${entry.name}/${sub.name.replace(/\.mdx$/, '')}`);
        }
      }
    }
  }
}
