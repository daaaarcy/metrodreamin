import { useStore, useSystem } from '../state/store'
import type { Line, ModeId, LineIcon } from '../types'
import { MODES } from '../data/modes'
import { BASE_COLORS, LINE_ICONS } from '../data/colors'
import { lineStats, fmtKm, fmtMin, fmtMoney, fmtRidership } from '../geo/stats'
import { flyTo } from '../map/mapRef'

export function LinePanel({ line }: { line: Line }) {
  const system = useSystem()
  const s = system ? lineStats(system, line) : null
  const selectLine = useStore((st) => st.selectLine)
  const selectStation = useStore((st) => st.selectStation)
  const setLineName = useStore((st) => st.setLineName)
  const setLineColor = useStore((st) => st.setLineColor)
  const setLineMode = useStore((st) => st.setLineMode)
  const setLineIcon = useStore((st) => st.setLineIcon)
  const deleteLine = useStore((st) => st.deleteLine)
  const setActivePath = useStore((st) => st.setActivePath)
  const activePath = useStore((st) => st.activePath)
  const beginDrag = useStore((st) => st.beginDrag)
  const endDrag = useStore((st) => st.endDrag)

  if (!system || !s) return null

  return (
    <div className="absolute left-3 top-16 bottom-4 w-80 panel z-10 flex flex-col overflow-hidden">
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <button className="btn text-xs" onClick={() => selectLine(null)}>
          ←
        </button>
        <span
          className="inline-block w-4 h-4 rounded-full border border-black/20 shrink-0"
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

        <div>
          <div className="label mb-1">Color</div>
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {BASE_COLORS.map((c) => (
              <button
                key={c}
                className="w-7 h-7 rounded-full border-2 cursor-pointer"
                style={{
                  backgroundColor: c,
                  borderColor: line.color === c ? '#111' : 'transparent',
                }}
                onClick={() => {
                  beginDrag()
                  setLineColor(line.id, c)
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
                className={`btn text-xs ${(line.icon ?? 'solid') === ic.id ? 'bg-blue-100 text-blue-800' : ''}`}
                onClick={() => setLineIcon(line.id, ic.id as LineIcon)}
              >
                {ic.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-black/5 rounded-lg py-2">
            <div className="text-sm font-semibold">{fmtKm(s.lengthKm)}</div>
            <div className="label">Length</div>
          </div>
          <div className="bg-black/5 rounded-lg py-2">
            <div className="text-sm font-semibold">{fmtMin(s.rideMin)}</div>
            <div className="label">Ride time</div>
          </div>
          <div className="bg-black/5 rounded-lg py-2">
            <div className="text-sm font-semibold">{fmtMoney(s.costMUsd)}</div>
            <div className="label">Est. cost</div>
          </div>
          <div className="bg-black/5 rounded-lg py-2">
            <div className="text-sm font-semibold">{fmtRidership(s.dailyRidership)}</div>
            <div className="label">Ridership</div>
          </div>
        </div>

        <div>
          <div className="label mb-1">Stops ({s.stops})</div>
          <div className="space-y-0.5">
            {line.stationIds.map((id, i) => {
              const p = system.stations[id]
              if (!p) return null
              const isWp = (line.waypointOverrides ?? []).includes(id)
              return (
                <button
                  key={`${id}-${i}`}
                  className="w-full text-left flex items-center gap-2 px-2 py-1 rounded-md hover:bg-black/5 text-sm cursor-pointer"
                  onClick={() => {
                    selectStation(id)
                    flyTo(p.lng, p.lat, Math.max(13, 0))
                  }}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${isWp ? 'bg-black/20' : ''}`}
                    style={isWp ? {} : { backgroundColor: line.color }}
                  />
                  <span className={isWp ? 'text-black/40 italic' : ''}>
                    {p.name || 'waypoint'}
                  </span>
                </button>
              )
            })}
          </div>
          {(line.branches ?? []).map((b, i) => (
            <div key={i} className="mt-2">
              <div className="text-[11px] text-black/45 px-2">
                Branch from {system.stations[b.rootStationId]?.name || 'station'} ({b.stationIds.length} pts)
              </div>
              {b.stationIds.map((id) => {
                const p = system.stations[id]
                if (!p) return null
                return (
                  <button
                    key={id}
                    className="w-full text-left flex items-center gap-2 px-2 py-1 rounded-md hover:bg-black/5 text-sm cursor-pointer"
                    onClick={() => selectStation(id)}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: line.color }} />
                    {p.name || 'waypoint'}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex gap-1.5">
          <button
            className={`btn flex-1 text-xs ${activePath?.lineId === line.id ? 'bg-blue-100 text-blue-800' : ''}`}
            onClick={() => setActivePath({ lineId: line.id, branchIndex: null, end: 'end' })}
          >
            ✏️ Keep drawing
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
