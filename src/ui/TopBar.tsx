import { useRef, useState } from 'react'
import { useStore, useSystem } from '../state/store'
import { BASEMAPS } from '../map/basemaps'
import { exportSystem } from '../state/persistence'
import { SearchBox } from './SearchBox'
import { flyTo } from '../map/mapRef'

export function TopBar() {
  const system = useSystem()
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const basemapId = useStore((s) => s.basemapId)
  const setBasemap = useStore((s) => s.setBasemap)
  const hideWaypoints = useStore((s) => s.hideWaypoints)
  const setHideWaypoints = useStore((s) => s.setHideWaypoints)
  const vehiclesOn = useStore((s) => s.vehiclesOn)
  const setVehiclesOn = useStore((s) => s.setVehiclesOn)
  const scoreOpen = useStore((s) => s.scoreOpen)
  const setScoreOpen = useStore((s) => s.setScoreOpen)
  const setDrawerOpen = useStore((s) => s.setDrawerOpen)
  const renameCurrentMap = useStore((s) => s.renameCurrentMap)
  const beginDrag = useStore((s) => s.beginDrag)
  const endDrag = useStore((s) => s.endDrag)
  const fileRef = useRef<HTMLInputElement>(null)
  const importMap = useStore((s) => s.importMap)
  const shareCurrentMap = useStore((s) => s.shareCurrentMap)
  const [shared, setShared] = useState(false)

  return (
    <div className="absolute top-3 left-3 right-3 z-20 flex items-start gap-2 pointer-events-none">
      <div className="panel flex items-center gap-1.5 px-2 py-1.5 pointer-events-auto">
        <button
          className="btn"
          title="My maps"
          onClick={() => setDrawerOpen(true)}
        >
          ☰
        </button>
        <span className="font-bold text-sm px-1 hidden sm:inline">MetroDreamer</span>
        <input
          className="bg-transparent text-sm font-medium px-1.5 py-1 rounded-md hover:bg-black/5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
          value={system?.meta.title ?? ''}
          placeholder="Untitled system"
          onFocus={beginDrag}
          onBlur={endDrag}
          onChange={(e) => renameCurrentMap(e.target.value)}
        />
      </div>

      <div className="panel px-2 py-1.5 w-56 pointer-events-auto hidden md:block">
        <SearchBox onSelect={(r) => flyTo(r.lng, r.lat, r.zoom)} />
      </div>

      <div className="flex-1" />

      <div className="panel flex items-center gap-1 px-2 py-1.5 pointer-events-auto">
        <button className="btn" disabled={!canUndo} title="Undo (⌘Z)" onClick={undo}
          style={{ opacity: canUndo ? 1 : 0.4 }}>
          ↺ Undo
        </button>
        <button className="btn" disabled={!canRedo} title="Redo (⇧⌘Z)" onClick={redo}
          style={{ opacity: canRedo ? 1 : 0.4 }}>
          ↻ Redo
        </button>
      </div>

      <div className="panel flex items-center gap-1 px-2 py-1.5 pointer-events-auto">
        <select
          className="text-sm bg-transparent outline-none cursor-pointer max-w-28"
          value={basemapId}
          onChange={(e) => setBasemap(e.target.value)}
          title="Basemap"
        >
          {BASEMAPS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <button
          className={`btn ${hideWaypoints ? 'bg-blue-100 text-blue-800' : ''}`}
          title="Hide waypoints"
          onClick={() => setHideWaypoints(!hideWaypoints)}
        >
          ✕·
        </button>
        <button
          className={`btn ${vehiclesOn ? 'bg-blue-100 text-blue-800' : ''}`}
          title="Animate vehicles"
          onClick={() => setVehiclesOn(!vehiclesOn)}
        >
          ▶
        </button>
        <button
          className={`btn ${scoreOpen ? 'bg-blue-100 text-blue-800' : ''}`}
          title="Score & stats"
          onClick={() => setScoreOpen(!scoreOpen)}
        >
          ★
        </button>
        <button
          className={`btn ${shared || system?.meta.remoteId ? 'bg-blue-100 text-blue-800' : ''}`}
          title="Sync this map to the local store + copy its share link (works on any port)"
          onClick={async () => {
            const link = await shareCurrentMap()
            if (!link) {
              alert('Store server is not running — start it with: npm run store')
              return
            }
            try {
              await navigator.clipboard.writeText(link)
            } catch {
              /* clipboard may be unavailable — link is already in the URL bar */
            }
            setShared(true)
            setTimeout(() => setShared(false), 1500)
          }}
        >
          {shared ? '✓' : '🔗'}
        </button>
        <button
          className="btn"
          title="Export JSON"
          onClick={() => system && exportSystem(system)}
        >
          ⬇
        </button>
        <button className="btn" title="Import JSON" onClick={() => fileRef.current?.click()}>
          ⬆
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const err = importMap(await f.text())
            if (err) alert(err)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
