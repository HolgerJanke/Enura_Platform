'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { HelpArticle } from './page'

type QuickLink = {
  title: string
  href: string
  description: string
  icon: string
}

type SearchResult = {
  title: string
  slug: string
  level: string
  excerpt: string
}

type HelpCentreClientProps = {
  articles: HelpArticle[]
  quickLinks: QuickLink[]
  accessibleLevels: Array<'company' | 'holding' | 'meta'>
}

const LEVEL_LABELS: Record<string, string> = {
  company: 'Unternehmen',
  holding: 'Holding-Verwaltung',
  meta: 'Plattform-Administration',
}

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  company: 'Anleitungen fuer den taeglichen Gebrauch der BI-Module.',
  holding: 'Mandantenverwaltung, Connectors und Berechtigungen.',
  meta: 'Plattformweite Einstellungen und technische Dokumentation.',
}

export function HelpCentreClient({
  articles,
  quickLinks,
  accessibleLevels,
}: HelpCentreClientProps) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          levels: accessibleLevels.join(','),
        })
        const response = await fetch(`/api/help/search?${params.toString()}`)
        if (response.ok) {
          const data = (await response.json()) as { data: SearchResult[] }
          setSearchResults(data.data)
        }
      } finally {
        setIsSearching(false)
      }
    },
    [accessibleLevels],
  )

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      void performSearch(query)
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [query, performSearch])

  const showResults = query.trim().length >= 2

  return (
    <div>
      {/* ------------------------------------------------------------------ */}
      {/* Search bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative mb-8">
        <label htmlFor="help-search" className="sr-only">
          Hilfe durchsuchen
        </label>
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            id="help-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchbegriff eingeben..."
            className="w-full rounded-brand border border-gray-300 bg-brand-background py-3 pl-10 pr-4 text-sm text-brand-text-primary placeholder:text-brand-text-secondary focus:border-transparent focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
            autoComplete="off"
          />
        </div>

        {/* Search results dropdown */}
        {showResults && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-brand border border-gray-200 bg-brand-surface shadow-lg">
            {isSearching ? (
              <div className="px-4 py-6 text-center text-sm text-brand-text-secondary">
                Suche laeuft...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-brand-text-secondary">
                Keine Ergebnisse gefunden.
              </div>
            ) : (
              <ul role="listbox" aria-label="Suchergebnisse">
                {searchResults.map((result) => (
                  <li key={`${result.level}/${result.slug}`}>
                    <Link
                      href={`/help/${result.level}/${result.slug}`}
                      className="block px-4 py-3 transition-colors hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-brand-text-primary">
                          {result.title}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                          style={{ backgroundColor: 'var(--brand-primary)' }}
                        >
                          {LEVEL_LABELS[result.level] ?? result.level}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-brand-text-secondary">
                        {result.excerpt}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Quick links grid                                                    */}
      {/* ------------------------------------------------------------------ */}
      {quickLinks.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-brand-text-primary">
            Schnellzugriff
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href + link.title}
                href={link.href}
                className="group flex items-start gap-3 rounded-brand border border-gray-200 bg-brand-surface p-4 transition-colors hover:border-gray-300 hover:shadow-sm"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand text-white"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                  aria-hidden="true"
                >
                  <QuickLinkIcon name={link.icon} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-text-primary group-hover:underline">
                    {link.title}
                  </p>
                  <p className="mt-0.5 text-xs text-brand-text-secondary">
                    {link.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Articles grouped by level                                           */}
      {/* ------------------------------------------------------------------ */}
      {accessibleLevels.map((level) => {
        const levelArticles = articles.filter((a) => a.level === level)
        if (levelArticles.length === 0) return null

        return (
          <section key={level} className="mb-10">
            <h2 className="mb-1 text-lg font-semibold text-brand-text-primary">
              {LEVEL_LABELS[level]}
            </h2>
            <p className="mb-4 text-xs text-brand-text-secondary">
              {LEVEL_DESCRIPTIONS[level]}
            </p>
            <ul className="divide-y divide-gray-200 rounded-brand border border-gray-200 bg-brand-surface">
              {levelArticles.map((article) => (
                <li key={article.slug}>
                  <Link
                    href={`/help/${article.level}/${article.slug}`}
                    className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-brand-text-primary">
                        {article.title}
                      </p>
                      <p className="mt-0.5 text-xs text-brand-text-secondary">
                        {article.excerpt}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2 text-xs text-brand-text-secondary">
                      <span>{article.readingTimeMinutes} Min.</span>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// QuickLinkIcon — Simple SVG icon mapper for quick link cards
// ---------------------------------------------------------------------------

const QUICK_LINK_ICON_PATHS: Record<string, string> = {
  Phone:
    'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  Calendar:
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  Briefcase:
    'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  Banknote:
    'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  Users:
    'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  ClipboardList:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  LayoutDashboard:
    'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z',
  Building:
    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  Settings:
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
}

function QuickLinkIcon({ name }: { name: string }) {
  const path = QUICK_LINK_ICON_PATHS[name]
  if (!path) {
    return (
      <span className="text-sm font-bold" aria-hidden="true">
        ?
      </span>
    )
  }

  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={path}
      />
    </svg>
  )
}
