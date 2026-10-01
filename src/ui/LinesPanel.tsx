import { useStore, useSystem } from '../state/store'
import { LinePanel } from './LinePanel'
import { StationPanel } from './StationPanel'
import { MODE_BY_ID } from '../data/modes'
import { lineStats, fmtKm } from '../geo/stats'

export function LinesPanel() {
  const system = useSystem()
  const selectedLineId = useStore((s) => s.selectedLineId)
  const selectedStationId = useStore((s) => s.selectedStationId)
  const selectLine = useStore((s) => s.selectLine)
  const selectStation = useStore((s) => s.selectStation)
  const addLine = useStore((s) => s.addLine)

  if (!system) return null

  if (selectedStationId && system.stations[selectedStationId]) {
    return <StationPanel stationId={selectedStationId} />
  }
  if (selectedLineId && system.lines[selectedLineId]) {
    return <LinePanel line={system.lines[selectedLineId]} />
  }

  const lines = Object.values(system.lines)

  return (
    <div className="absolute left-3 top-16 bottom-4 w-72 panel z-10 flex flex-col overflow-hidden">
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <span className="label">Lines</span>
        <button className="btn btn-primary text-xs" onClick={() => addLine()}>
          + New line
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {lines.length === 0 && (
          <div className="text-sm text-black/50 px-2 py-3">
            No lines yet — tap anywhere on the map to add your first station.
          </div>
        )}
        {lines.map((line) => {
          const s = lineStats(system, line)
          return (
            <button
              key={line.id}
              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-black/5 cursor-pointer"
              onClick={() => {
                selectLine(line.id)
                selectStation(null)
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3.5 h-3.5 rounded-full border border-black/20"
                  style={{ backgroundColor: line.color }}
                />
                <span className="font-medium text-sm flex-1 truncate">{line.name}</span>
                <span className="text-xs text-black/40">{MODE_BY_ID[line.mode].emoji}</span>
              </div>
              <div className="text-[11px] text-black/45 pl-5.5 mt-0.5">
                {s.stops} stops · {fmtKm(s.lengthKm)}
              </div>
            </button>
          )
        })}
      </div>
      <div className="px-3 py-2 border-t border-black/10 text-[11px] text-black/45">
        Click map: add station · Click station: edit · Click a line: add waypoint · Drag stations
        to move them
      </div>
    </div>
  )
}
