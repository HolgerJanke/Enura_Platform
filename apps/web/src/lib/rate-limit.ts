type RateLimitEntry = {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5

/**
 * Check if a key is rate limited. Returns { limited, retryAfterMs }.
 * Call this before processing login or TOTP verification.
 */
export function checkRateLimit(key: string): { limited: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { limited: false, retryAfterMs: 0 }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { limited: true, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { limited: false, retryAfterMs: 0 }
}

/**
 * Reset the rate limit for a key (e.g. after successful login).
 */
export function resetRateLimit(key: string): void {
  store.delete(key)
}

/**
 * Periodic cleanup of expired entries (call on interval or lazily).
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}
