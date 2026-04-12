'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  id: string
  title: string
  customer_name: string
  address_city: string | null
  status: string
  project_value: number | null
}

interface Props {
  companyId: string
}

export function ProjectSearch({ companyId }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/search?q=${encodeURIComponent(query)}&companyId=${companyId}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.results ?? [])
          setOpen(true)
        }
      } catch { /* empty */ }
      setLoading(false)
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, companyId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(id: string) {
    setOpen(false)
    setQuery('')
    router.push(`/projects/${id}`)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5">
        <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
          placeholder="Projekt suchen..."
          className="w-40 sm:w-56 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
        />
        {loading && (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 shrink-0" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r.id)}
              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <p className="text-sm font-medium text-gray-900 truncate">{r.customer_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {r.address_city && <span className="text-xs text-gray-500">{r.address_city}</span>}
                {r.project_value != null && (
                  <span className="text-xs font-mono text-gray-500">
                    CHF {Number(r.project_value).toLocaleString('de-CH', { minimumFractionDigits: 0 })}
                  </span>
                )}
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${
                  r.status === 'active' ? 'bg-green-100 text-green-700' :
                  r.status === 'completed' ? 'bg-gray-100 text-gray-500' :
                  'bg-amber-100 text-amber-700'
                }`}>{r.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-gray-200 bg-white shadow-lg z-50 p-4">
          <p className="text-sm text-gray-500 text-center">Keine Projekte gefunden.</p>
        </div>
      )}
    </div>
  )
}
