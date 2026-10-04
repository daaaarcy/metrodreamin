import { useRef, useState } from 'react'
import { useStore, useSystem } from '../state/store'
import { BASEMAPS } from '../map/basemaps'
import { exportSystem } from '../state/persistence'

const IB = 'btn w-8 h-8 p-0 flex items-center justify-center relative'

export function MapActions() {
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
  const addingWaypoints = useStore((s) => s.addingWaypoints)
  const setAddingWaypoints = useStore((s) => s.setAddingWaypoints)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)
  const saveStatus = useStore((s) => s.saveStatus)
  const save = useStore((s) => s.save)
  const saveCopy = useStore((s) => s.saveCopy)
  const setDrawerOpen = useStore((s) => s.setDrawerOpen)
  const importMap = useStore((s) => s.importMap)
  const shareCurrentMap = useStore((s) => s.shareCurrentMap)
  const fileRef = useRef<HTMLInputElement>(null)
  const [shared, setShared] = useState(false)

  const saveTitle =
    saveStatus.error ??
    (saveStatus.at ? `Saved ${new Date(saveStatus.at).toLocaleTimeString()}` : 'Save (⌘S)')
  const dot = saveStatus.error ? '#ef4444' : saveStatus.syncing ? '#4da3ff' : '#22c55e'

  return (
    <div className="panel flex items-center gap-1 px-1.5 py-1.5 pointer-events-auto">
      <button className={IB} title="My maps" onClick={() => setDrawerOpen(true)}>
        ☰
      </button>
      <button className={IB} title={saveTitle} onClick={() => void save()}>
        💾
        <span
          className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: dot }}
        />
      </button>
      <button className={IB} title="Save as copy" onClick={saveCopy}>
        ⧉
      </button>
      <button
        className={IB}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        onClick={undo}
        style={{ opacity: canUndo ? 1 : 0.4 }}
      >
        ↺
      </button>
      <button
        className={IB}
        disabled={!canRedo}
        title="Redo (⇧⌘Z)"
        onClick={redo}
        style={{ opacity: canRedo ? 1 : 0.4 }}
      >
        ↻
      </button>
      <button
        className={`${IB} ${addingWaypoints ? 'is-on' : ''}`}
        title={
          addingWaypoints
            ? 'Adding waypoints — click to add stations instead'
            : 'Add waypoints instead of stations'
        }
        onClick={() => setAddingWaypoints(!addingWaypoints)}
      >
        ◦
      </button>
      <button
        className={`${IB} ${hideWaypoints ? 'is-on' : ''}`}
        title="Hide waypoints"
        onClick={() => setHideWaypoints(!hideWaypoints)}
      >
        ✕·
      </button>
      <button
        className={`${IB} ${vehiclesOn ? 'is-on' : ''}`}
        title="Animate vehicles"
        onClick={() => setVehiclesOn(!vehiclesOn)}
      >
        ▶
      </button>
      <select
        className="h-8 text-sm bg-transparent outline-none cursor-pointer max-w-24 text-fg"
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
        className={IB}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <button
        className={`${IB} ${shared || system?.meta.remoteId ? 'is-on' : ''}`}
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
      <button className={IB} title="Export JSON" onClick={() => system && exportSystem(system)}>
        ⬇
      </button>
      <button className={IB} title="Import JSON" onClick={() => fileRef.current?.click()}>
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
      <button
        className={IB}
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? '⇥' : '⇤'}
      </button>
    </div>
  )
}
