'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// Generic search type. "interests" returns { id, name }. "cities" / "regions" return { key, name, ... }.
type SearchKind = 'interests' | 'cities' | 'regions'

export interface SearchOption {
  id: string // for interests: Meta's id; for geo: the `key`
  name: string
  subtitle?: string // e.g. "São Paulo, Brazil" for geo, or audience size for interest
}

interface TargetingSearchProps {
  kind: SearchKind
  label: string
  placeholder?: string
  selected: SearchOption[]
  onChange: (next: SearchOption[]) => void
  inputId?: string
  max?: number // optional cap
}

interface RawInterestRow {
  id: string
  name: string
  audienceSize: number | null
  path: string[]
}
interface RawGeoRow {
  key: string
  name: string
  type: string
  countryCode: string
  region: string | null
}

function formatNumberShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

export default function TargetingSearch({
  kind,
  label,
  placeholder,
  selected,
  onChange,
  inputId,
  max,
}: TargetingSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      try {
        const res = await fetch(
          `/api/instagram/meta-targeting/search?type=${kind}&q=${encodeURIComponent(query)}`,
          { signal: ac.signal }
        )
        if (!res.ok) {
          setResults([])
          return
        }
        const json = (await res.json()) as { data: RawInterestRow[] | RawGeoRow[] }
        const mapped: SearchOption[] =
          kind === 'interests'
            ? (json.data as RawInterestRow[]).map((r) => ({
                id: r.id,
                name: r.name,
                subtitle:
                  r.audienceSize !== null
                    ? `~${formatNumberShort(r.audienceSize)} pessoas`
                    : r.path?.slice(0, 2).join(' › '),
              }))
            : (json.data as RawGeoRow[]).map((r) => ({
                id: r.key,
                name: r.name,
                subtitle: [r.region, r.countryCode].filter(Boolean).join(', '),
              }))
        setResults(mapped)
        setOpen(true)
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(t)
  }, [query, kind])

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function add(opt: SearchOption) {
    if (selected.some((s) => s.id === opt.id)) return
    if (max && selected.length >= max) return
    onChange([...selected, opt])
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s.id !== id))
  }

  const atCap = Boolean(max && selected.length >= max)

  return (
    <div className="space-y-1.5" ref={wrapperRef}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((opt) => (
            <span
              key={opt.id}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs"
            >
              <span>{opt.name}</span>
              <button
                type="button"
                onClick={() => remove(opt.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remover ${opt.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={atCap ? `Limite de ${max} atingido` : placeholder ?? 'Digite para buscar...'}
          disabled={atCap}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60"
        />

        {open && (results.length > 0 || loading) && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            {loading && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>
            )}
            <ul className="max-h-64 overflow-y-auto">
              {results.map((opt) => {
                const already = selected.some((s) => s.id === opt.id)
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => add(opt)}
                      disabled={already}
                      className={cn(
                        'flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm transition-colors',
                        already
                          ? 'cursor-not-allowed text-muted-foreground'
                          : 'hover:bg-muted/60'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{opt.name}</div>
                        {opt.subtitle && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {opt.subtitle}
                          </div>
                        )}
                      </div>
                      {already && <span className="text-[11px]">já adicionado</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
