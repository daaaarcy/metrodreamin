import { useRef } from 'react'
import { useStore } from '../state/store'
import { mapIndex, exportSystem } from '../state/persistence'

export function MapListDrawer() {
  const open = useStore((s) => s.drawerOpen)
  const setOpen = useStore((s) => s.setDrawerOpen)
  const systems = useStore((s) => s.systems)
  const currentId = useStore((s) => s.currentId)
  const openMap = useStore((s) => s.openMap)
  const deleteMap = useStore((s) => s.deleteMap)
  const duplicateMap = useStore((s) => s.duplicateMap)
  const setNewMapOpen = useStore((s) => s.setNewMapOpen)
  const importMap = useStore((s) => s.importMap)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const entries = mapIndex(systems)

  return (
    <div className="absolute inset-0 z-30">
      <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
      <div className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-2xl flex flex-col">
        <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between">
          <span className="font-bold">My maps</span>
          <button className="btn text-xs" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <div className="px-3 py-2 flex gap-1.5">
          <button
            className="btn btn-primary flex-1 text-sm"
            onClick={() => setNewMapOpen(true)}
          >
            + New map
          </button>
          <button className="btn text-sm" onClick={() => fileRef.current?.click()}>
            ⬆ Import
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
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
          {entries.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg border px-3 py-2 ${m.id === currentId ? 'border-blue-400 bg-blue-50/50' : 'border-black/10'}`}
            >
              <button
                className="w-full text-left cursor-pointer"
                onClick={() => openMap(m.id)}
              >
                <div className="font-medium text-sm truncate">{m.title}</div>
                <div className="text-[11px] text-black/45">
                  {m.lineCount} lines · {m.stationCount} pts ·{' '}
                  {new Date(m.updatedAt).toLocaleDateString()}
                </div>
              </button>
              <div className="flex gap-1 mt-1.5">
                <button
                  className="text-[11px] px-1.5 py-0.5 rounded bg-black/5 hover:bg-black/10 cursor-pointer"
                  onClick={() => duplicateMap(m.id)}
                >
                  duplicate
                </button>
                <button
                  className="text-[11px] px-1.5 py-0.5 rounded bg-black/5 hover:bg-black/10 cursor-pointer"
                  onClick={() => exportSystem(systems[m.id])}
                >
                  export
                </button>
                <button
                  className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                  onClick={() => {
                    if (confirm(`Delete “${m.title}”? This cannot be undone.`)) deleteMap(m.id)
                  }}
                >
                  delete
                </button>
              </div>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="text-sm text-black/45 px-1 py-4">No saved maps yet.</div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-black/10 text-[10px] text-black/40">
          Maps are stored locally in your browser. Export to keep a file copy.
        </div>
      </div>
    </div>
  )
}
