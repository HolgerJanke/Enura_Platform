'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const COOKIE_NAME = 'enura_cookie_consent'
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60 // 1 year

function getBrowserCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1] ?? '') : undefined
}

function setBrowserCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};samesite=lax`
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!getBrowserCookie(COOKIE_NAME)) {
      setVisible(true)
    }
  }, [])

  function handleAccept() {
    setBrowserCookie(COOKIE_NAME, 'accepted', COOKIE_MAX_AGE_SECONDS)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie-Hinweis"
      className="fixed bottom-0 left-0 right-0 z-50 border-t p-4 shadow-lg"
      style={{
        backgroundColor: 'var(--brand-surface, #F9FAFB)',
        borderColor: 'var(--brand-text-secondary, #6B7280)',
        color: 'var(--brand-text-primary, #111827)',
      }}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm leading-relaxed">
          Diese Website verwendet technisch notwendige Cookies, um die
          Funktionalitaet der Plattform sicherzustellen. Weitere Informationen
          finden Sie in unserer{' '}
          <Link
            href="/privacy"
            className="underline underline-offset-2"
            style={{ color: 'var(--brand-primary, #1A56DB)' }}
          >
            Datenschutzerklaerung
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={handleAccept}
          className="shrink-0 rounded px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{
            backgroundColor: 'var(--brand-primary, #1A56DB)',
            borderRadius: 'var(--brand-radius, 8px)',
          }}
        >
          Verstanden
        </button>
      </div>
    </div>
  )
}
