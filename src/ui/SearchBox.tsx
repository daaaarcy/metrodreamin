import { useEffect, useRef, useState } from 'react'

export interface SearchResult {
  displayName: string
  lng: number
  lat: number
  zoom: number
}

interface Props {
  placeholder?: string
  autoFocus?: boolean
  onSelect: (r: SearchResult) => void
}

interface NominatimHit {
  display_name: string
  lon: string
  lat: string
  type: string
  addresstype?: string
}

function zoomFor(hit: NominatimHit): number {
  const t = hit.addresstype ?? hit.type
  if (['country', 'state', 'county'].includes(t)) return 6
  if (['city', 'town', 'island'].includes(t)) return 11
  if (['village', 'suburb', 'borough'].includes(t)) return 13
  return 14
}

export function SearchBox({ placeholder, autoFocus, onSelect }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef<number>(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (q.trim().length < 3) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`,
          { headers: { Accept: 'application/json' } },
        )
        const hits = (await res.json()) as NominatimHit[]
        setResults(
          hits.map((h) => ({
            displayName: h.display_name,
            lng: parseFloat(h.lon),
            lat: parseFloat(h.lat),
            zoom: zoomFor(h),
          })),
        )
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => window.clearTimeout(timer.current)
  }, [q])

  return (
    <div ref={boxRef} className="relative">
      <input
        className="input"
        autoFocus={autoFocus}
        placeholder={placeholder ?? 'Search for a place…'}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {loading && (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-black/40">
          …
        </div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full panel overflow-hidden max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-black/5 cursor-pointer"
              onClick={() => {
                setOpen(false)
                setQ('')
                setResults([])
                onSelect(r)
              }}
            >
              {r.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
