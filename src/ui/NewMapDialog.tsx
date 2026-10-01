import { useState } from 'react'
import { useStore } from '../state/store'
import { SearchBox, type SearchResult } from './SearchBox'
import { flyTo } from '../map/mapRef'

export function NewMapDialog() {
  const open = useStore((s) => s.newMapOpen)
  const setOpen = useStore((s) => s.setNewMapOpen)
  const newMap = useStore((s) => s.newMap)
  const importMap = useStore((s) => s.importMap)
  const hasMaps = useStore((s) => Object.keys(s.systems).length > 0)
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState<SearchResult | null>(null)

  if (!open) return null

  const create = () => {
    newMap(title.trim() || 'Untitled system')
    if (place) setTimeout(() => flyTo(place.lng, place.lat, place.zoom), 350)
  }

  const loadDemo = async () => {
    try {
      const res = await fetch('/demo.json')
      const text = await res.text()
      const err = importMap(text)
      if (err) alert(err)
      else setTimeout(() => flyTo(-73.99, 40.74, 12), 350)
    } catch {
      alert('Could not load the demo map.')
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="panel w-[26rem] p-5">
        <div className="font-bold text-lg mb-1">New map</div>
        <div className="text-sm text-black/55 mb-4">
          Name your system and pick a city to start from — or begin anywhere.
        </div>
        <div className="space-y-3">
          <div>
            <div className="label mb-1">Title</div>
            <input
              className="input"
              autoFocus
              placeholder="e.g. Dream London 2050"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
          </div>
          <div>
            <div className="label mb-1">Start location (optional)</div>
            <SearchBox
              placeholder="Search for a city…"
              onSelect={(r) => setPlace(r)}
            />
            {place && (
              <div className="text-xs text-green-700 mt-1">📍 {place.displayName}</div>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="btn btn-primary flex-1" onClick={create}>
            Create map
          </button>
          <button className="btn" onClick={loadDemo}>
            Load demo
          </button>
          {hasMaps && (
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
