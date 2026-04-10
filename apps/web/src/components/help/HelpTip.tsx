'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

type HelpSnippet = {
  title: string
  content: string
  article_slug?: string | null
  article_level?: string | null
}

type HelpTipProps = {
  /** The location_key used to fetch the snippet from the API. */
  locationKey: string
  /** Pre-loaded snippet data. If provided, skips the API call. */
  snippet?: HelpSnippet
  /** Popover position relative to the trigger button. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Optional locale override. Defaults to "de". */
  locale?: string
}

const SIDE_CLASSES: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
}

/**
 * Contextual help tooltip component.
 *
 * Renders a small "?" icon button. On click, shows a popover with:
 *   - Snippet title
 *   - Content (rendered as simple markdown)
 *   - Optional link to the full article
 *
 * Fetches snippet from `/api/help/snippets/[locationKey]` if not pre-loaded.
 * Closes on outside click or Escape key.
 */
export function HelpTip({
  locationKey,
  snippet: preloadedSnippet,
  side = 'bottom',
  locale = 'de',
}: HelpTipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [snippetData, setSnippetData] = useState<HelpSnippet | null>(
    preloadedSnippet ?? null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch snippet on first open if not pre-loaded
  const fetchSnippet = useCallback(async () => {
    if (snippetData || isLoading) return

    setIsLoading(true)
    setHasError(false)

    try {
      const response = await fetch(`/api/help/snippets/${encodeURIComponent(locationKey)}`, {
        headers: { 'x-locale': locale },
      })
      if (response.ok) {
        const json = (await response.json()) as { data: HelpSnippet }
        setSnippetData(json.data)
      } else {
        setHasError(true)
      }
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [locationKey, locale, snippetData, isLoading])

  function handleToggle() {
    const willOpen = !isOpen
    setIsOpen(willOpen)
    if (willOpen && !snippetData) {
      void fetchSnippet()
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscapeKey)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative inline-flex">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-[11px] font-semibold text-brand-text-secondary transition-colors hover:border-gray-400 hover:text-brand-text-primary"
        style={isOpen ? { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' } : undefined}
        aria-label="Hilfe anzeigen"
        aria-expanded={isOpen}
      >
        ?
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          className={`absolute z-50 w-72 rounded-brand border border-gray-200 bg-brand-surface p-4 shadow-lg ${SIDE_CLASSES[side] ?? SIDE_CLASSES.bottom}`}
          role="tooltip"
        >
          {isLoading && (
            <p className="text-xs text-brand-text-secondary">Wird geladen...</p>
          )}

          {hasError && (
            <p className="text-xs text-brand-text-secondary">
              Hilfetext konnte nicht geladen werden.
            </p>
          )}

          {snippetData && (
            <>
              <p className="mb-2 text-sm font-semibold text-brand-text-primary">
                {snippetData.title}
              </p>
              <div
                className="text-xs leading-relaxed text-brand-text-secondary"
                dangerouslySetInnerHTML={{
                  __html: renderSnippetMarkdown(snippetData.content),
                }}
              />
              {snippetData.article_slug && snippetData.article_level && (
                <Link
                  href={`/help/${snippetData.article_level}/${snippetData.article_slug}`}
                  className="mt-3 inline-block text-xs font-medium hover:underline"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  Vollständigen Artikel lesen →
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Minimal markdown renderer for short snippet content
// ---------------------------------------------------------------------------

function renderSnippetMarkdown(md: string): string {
  let result = escapeHtml(md.trim())

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Inline code
  result = result.replace(/`(.+?)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-[10px]">$1</code>')
  // Line breaks → <br>
  result = result.replace(/\n/g, '<br />')

  return result
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
