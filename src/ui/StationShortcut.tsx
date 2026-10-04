import { useEffect, useState } from 'react'
import { useStore, useSystem } from '../state/store'
import { nearestLines } from '../geo/query'
import { mapApi } from '../map/mapRef'

/** Floating mini-toolbar that follows the selected point (MD's shortcut popup). */
export function StationShortcut() {
  const system = useSystem()
  const selectedStationId = useStore((s) => s.selectedStationId)
  const recentLineId = useStore((s) => s.recentLineId)
  const addToLine = useStore((s) => s.addToLine)
  const convertPoint = useStore((s) => s.convertPoint)
  const deletePoint = useStore((s) => s.deletePoint)
  const [pos, setPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const p = selectedStationId ? system?.stations[selectedStationId] : undefined

  useEffect(() => {
    const map = mapApi.map
    if (!map || !p) return
    const update = () => {
      const pt = map.project([p.lng, p.lat])
      const { clientWidth: w, clientHeight: h } = map.getCanvas()
      const off = pt.x < -20 || pt.y < -20 || pt.x > w + 20 || pt.y > h + 20
      setPos(off ? null : { id: p.id, x: pt.x + 14, y: pt.y - 46 })
    }
    const down = () => setDragging(true)
    const up = () => setDragging(false)
    const raf = requestAnimationFrame(update)
    map.on('move', update)
    map.on('mousedown', down)
    map.on('mouseup', up)
    return () => {
      cancelAnimationFrame(raf)
      map.off('move', update)
      map.off('mousedown', down)
      map.off('mouseup', up)
    }
  }, [p?.id, p?.lng, p?.lat]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!system || !p || !pos || pos.id !== p.id || dragging) return null
  const near = nearestLines(system, p.id, 3, recentLineId)

  return (
    <div
      className="absolute z-20 panel flex items-center gap-1 px-1.5 py-1"
      style={{ left: pos.x, top: pos.y }}
    >
      {near.map((l) => (
        <button
          key={l.id}
          title={`Add to ${l.name}`}
          className="w-4 h-4 rounded-full border border-line cursor-pointer"
          style={{ backgroundColor: l.color }}
          onClick={() => addToLine(l.id, p.id)}
        />
      ))}
      <button
        className="btn text-xs !px-1.5 !py-0.5"
        title={p.waypoint ? 'Convert to station' : 'Convert to waypoint'}
        onClick={() => convertPoint(p.id, !p.waypoint)}
      >
        {p.waypoint ? '◉' : '◦'}
      </button>
      <button
        className="btn text-xs !px-1.5 !py-0.5"
        title="Delete"
        onClick={() => deletePoint(p.id)}
      >
        🗑
      </button>
    </div>
  )
}
