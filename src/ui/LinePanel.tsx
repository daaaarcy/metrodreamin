import { useStore, useSystem } from '../state/store'
import type { ReactNode } from 'react'
import type { Line, ModeId, LineIcon, SystemMap } from '../types'
import { MODES } from '../data/modes'
import { DEFAULT_LINES, LINE_ICONS } from '../data/colors'
import { lineStats, fmtKm, fmtMin, fmtMoney, fmtRidership } from '../geo/stats'
import { linesThrough } from '../geo/query'
import { flyTo } from '../map/mapRef'

/** Other lines that stop at this point (for transfer chips). */
function transferLines(sys: SystemMap, line: Line, pointId: string): Line[] {
  return linesThrough(sys, pointId).filter(
    (l) => l.id !== line.id && !(l.waypointOverrides ?? []).includes(pointId),
  )
}

export function LinePanel({ line }: { line: Line }) {
  const system = useSystem()
  const s = system ? lineStats(system, line) : null
  const selectLine = useStore((st) => st.selectLine)
  const selectStation = useStore((st) => st.selectStation)
  const setLineName = useStore((st) => st.setLineName)
  const setLineColor = useStore((st) => st.setLineColor)
  const setLineMode = useStore((st) => st.setLineMode)
  const setLineIcon = useStore((st) => st.setLineIcon)
  const setLineGroup = useStore((st) => st.setLineGroup)
  const deleteLine = useStore((st) => st.deleteLine)
  const removeFromLine = useStore((st) => st.removeFromLine)
  const removePointsFromLine = useStore((st) => st.removePointsFromLine)
  const reverseLine = useStore((st) => st.reverseLine)
  const duplicateLine = useStore((st) => st.duplicateLine)
  const beginDrag = useStore((st) => st.beginDrag)
  const endDrag = useStore((st) => st.endDrag)

  if (!system || !s) return null
  const overrides = new Set(line.waypointOverrides ?? [])
  const isWp = (id: string) => !!system.stations[id]?.waypoint || overrides.has(id)
  const groups = Object.values(system.lineGroups ?? {}).sort((a, b) =>
    a.label.toLowerCase().localeCompare(b.label.toLowerCase()),
  )

  // stop rows: runs of consecutive waypoints collapse into one removable row
  const stopRows = (ids: string[]) => {
    const rows: ReactNode[] = []
    let i = 0
    while (i < ids.length) {
      const id = ids[i]
      const p = system.stations[id]
      if (!p) {
        i++
        continue
      }
      if (isWp(id)) {
        const run = [id]
        while (i + run.length < ids.length && isWp(ids[i + run.length])) {
          run.push(ids[i + run.length])
        }
        const start = i
        i += run.length
        rows.push(
          <div
            key={`wp-${id}-${start}`}
            className="flex items-center gap-2 px-2 py-1 text-sm"
          >
            <span className="w-2 h-2 rounded-full shrink-0 bg-muted opacity-40" />
            <span className="flex-1 text-muted italic">
              {run.length} waypoint{run.length === 1 ? '' : 's'}
            </span>
            <button
              className="text-[11px] px-1.5 py-0.5 rounded bg-subtle text-muted hover:bg-red-500/15 hover:text-red-500 cursor-pointer"
              title="Remove these waypoints from the line"
              onClick={() => removePointsFromLine(line.id, run)}
            >
              −
            </button>
          </div>,
        )
      } else {
        i++
        const transfers = transferLines(system, line, id)
        rows.push(
          <div key={`st-${id}-${i}`} className="flex items-center gap-2 px-2 py-1 text-sm">
            <button
              className="flex items-center gap-2 flex-1 text-left min-w-0 hover:bg-hover rounded-md cursor-pointer"
              onClick={() => {
                selectStation(id)
                flyTo(p.lng, p.lat, 13)
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: line.color }}
              />
              <span className="truncate">{p.name || 'Unnamed station'}</span>
            </button>
            {transfers.map((t) => (
              <span
                key={t.id}
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: t.color }}
                title={t.name}
              />
            ))}
            <button
              className="text-[11px] px-1.5 py-0.5 rounded bg-subtle text-muted hover:bg-red-500/15 hover:text-red-500 cursor-pointer"
              title={`Remove ${p.name || 'station'} from ${line.name}`}
              onClick={() => removeFromLine(line.id, id)}
            >
              −
            </button>
          </div>,
        )
      }
    }
    return rows
  }

  return (
    <div className="absolute left-3 top-16 bottom-4 w-80 panel z-10 flex flex-col overflow-hidden">
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <button className="btn text-xs" onClick={() => selectLine(null)}>
          ←
        </button>
        <span
          className="inline-block w-4 h-4 rounded-full border border-line shrink-0"
          style={{ backgroundColor: line.color }}
        />
        <input
          className="input font-medium"
          value={line.name}
          onFocus={beginDrag}
          onBlur={endDrag}
          onChange={(e) => setLineName(line.id, e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
        <div>
          <div className="label mb-1">Mode</div>
          <select
            className="input"
            value={line.mode}
            onChange={(e) => setLineMode(line.id, e.target.value as ModeId)}
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.emoji} {m.label} · {m.speedKmh} km/h
              </option>
            ))}
          </select>
        </div>

        {groups.length > 0 && (
          <div>
            <div className="label mb-1">Group</div>
            <select
              className="input"
              value={line.groupId ?? ''}
              onChange={(e) => setLineGroup(line.id, e.target.value || null)}
            >
              <option value="">No group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="label mb-1">Color</div>
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {DEFAULT_LINES.map((d) => (
              <button
                key={d.color}
                className="w-7 h-7 rounded-full border-2 cursor-pointer"
                title={d.name}
                style={{
                  backgroundColor: d.color,
                  borderColor: line.color === d.color ? 'var(--fg)' : 'transparent',
                }}
                onClick={() => {
                  beginDrag()
                  setLineColor(line.id, d.color)
                  endDrag()
                }}
              />
            ))}
          </div>
          <input
            className="input"
            value={line.color}
            onFocus={beginDrag}
            onBlur={endDrag}
            onChange={(e) => setLineColor(line.id, e.target.value)}
            placeholder="#rrggbb"
          />
        </div>

        <div>
          <div className="label mb-1">Icon pattern</div>
          <div className="flex gap-1 flex-wrap">
            {LINE_ICONS.map((ic) => (
              <button
                key={ic.id}
                className={`btn text-xs ${(line.icon ?? 'solid') === ic.id ? 'is-on' : ''}`}
                onClick={() => setLineIcon(line.id, ic.id as LineIcon)}
              >
                {ic.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-subtle rounded-lg py-2">
            <div className="text-sm font-semibold">{fmtKm(s.lengthKm)}</div>
            <div className="label">Length</div>
          </div>
          <div className="bg-subtle rounded-lg py-2">
            <div className="text-sm font-semibold">{fmtMin(s.rideMin)}</div>
            <div className="label">Ride time</div>
          </div>
          <div className="bg-subtle rounded-lg py-2">
            <div className="text-sm font-semibold">{s.stops}</div>
            <div className="label">Stations</div>
          </div>
          <div className="bg-subtle rounded-lg py-2">
            <div className="text-sm font-semibold">{fmtRidership(s.dailyRidership)}</div>
            <div className="label">Ridership</div>
          </div>
          <div className="bg-subtle rounded-lg py-2 col-span-2">
            <div className="text-sm font-semibold">{fmtMoney(s.costMUsd)}</div>
            <div className="label">Est. cost</div>
          </div>
        </div>

        <div>
          <div className="label mb-1">Stops ({s.stops})</div>
          <div className="space-y-0.5">{stopRows(line.stationIds)}</div>
          {(line.branches ?? []).map((b, i) => (
            <div key={i} className="mt-2">
              <div className="text-[11px] text-muted px-2">
                Branch from {system.stations[b.rootStationId]?.name || 'station'} (
                {b.stationIds.length} pts)
              </div>
              <div className="space-y-0.5">{stopRows(b.stationIds)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button className="btn flex-1 text-xs" onClick={() => reverseLine(line.id)}>
            ⇄ Reverse station order
          </button>
          <button className="btn flex-1 text-xs" onClick={() => duplicateLine(line.id)}>
            ⧉ Duplicate line
          </button>
          <button
            className="btn btn-danger flex-1 text-xs"
            onClick={() => {
              if (confirm(`Delete ${line.name}?`)) deleteLine(line.id)
            }}
          >
            Delete line
          </button>
        </div>
      </div>
    </div>
  )
}
