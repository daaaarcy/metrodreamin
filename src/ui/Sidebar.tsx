import { useStore, useSystem } from '../state/store'
import { systemStats, lineStats, fmtKm, fmtMin, fmtMoney, fmtRidership } from '../geo/stats'
import { MODE_BY_ID } from '../data/modes'
import { LineGroups } from './LineGroups'

const fmtDate = (t: number) => new Date(t).toLocaleDateString()
const relTime = (t: number) => {
  const d = Date.now() - t
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)}h ago`
  return fmtDate(t)
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-subtle rounded-lg py-1.5 text-center">
      <div className="text-sm font-semibold">{value}</div>
      <div className="label">{label}</div>
    </div>
  )
}

export function Sidebar() {
  const system = useSystem()
  const renameCurrentMap = useStore((s) => s.renameCurrentMap)
  const setCaption = useStore((s) => s.setCaption)
  const detailsOpen = useStore((s) => s.detailsOpen)
  const setDetailsOpen = useStore((s) => s.setDetailsOpen)
  const selectLine = useStore((s) => s.selectLine)
  const beginDrag = useStore((s) => s.beginDrag)
  const endDrag = useStore((s) => s.endDrag)

  if (!system) return null
  const s = systemStats(system)
  const stations = Object.values(system.stations).filter((p) => !p.waypoint).length
  const waypoints = Object.values(system.stations).filter((p) => p.waypoint).length

  return (
    <div className="w-[340px] shrink-0 bg-panel text-fg backdrop-blur-md border-l border-line flex flex-col overflow-hidden z-10">
      <div className="px-4 pt-4 pb-2">
        <input
          className="w-full text-xl font-bold bg-transparent outline-none placeholder:text-muted"
          value={system.meta.title}
          placeholder="Untitled system"
          onFocus={beginDrag}
          onBlur={endDrag}
          onChange={(e) => renameCurrentMap(e.target.value)}
        />
        <div className="text-muted text-xs mt-0.5">
          Local map · created {fmtDate(system.meta.createdAt)} · updated{' '}
          {relTime(system.meta.updatedAt)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="label">Score</span>
            <button
              className="text-xs text-accent cursor-pointer"
              onClick={() => setDetailsOpen(!detailsOpen)}
            >
              {detailsOpen ? 'Hide details' : 'Show details'}
            </button>
          </div>
          <div className="text-2xl font-bold">{s.score.toLocaleString()}</div>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            <Stat label="Ridership" value={fmtRidership(s.dailyRidership)} />
            <Stat label="Cost" value={fmtMoney(s.costMUsd)} />
            <Stat label="Stations" value={stations} />
            <Stat label="Lines" value={s.lines} />
            <Stat label="Modes" value={s.modes} />
            <Stat label="Length" value={fmtKm(s.lengthKm)} />
          </div>
          <div className="text-muted text-xs mt-1.5">
            Waypoints: {waypoints} · Interchanges: {s.interchanges}
          </div>

          {detailsOpen && (
            <div className="mt-2 space-y-1.5">
              {Object.values(system.lines).map((l) => {
                const ls = lineStats(system, l)
                return (
                  <button
                    key={l.id}
                    className="w-full text-left px-2.5 py-2 rounded-lg bg-subtle hover:bg-hover cursor-pointer"
                    onClick={() => selectLine(l.id)}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: l.color }}
                      />
                      <span className="truncate flex-1">{l.name}</span>
                      <span className="text-muted text-xs font-normal">
                        {MODE_BY_ID[l.mode].emoji}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      {fmtKm(ls.lengthKm)} · {fmtMin(ls.rideMin)} · {fmtMoney(ls.costMUsd)} ·{' '}
                      {fmtRidership(ls.dailyRidership)}
                    </div>
                  </button>
                )
              })}
              {Object.keys(system.lines).length === 0 && (
                <div className="text-xs text-muted">Draw some lines to see stats.</div>
              )}
              <div className="text-[10px] text-muted pt-1">
                Costs use mode-based $/km with grade multipliers (elevated ×1.6, underground
                ×3.2). Ridership is a per-stop heuristic. Both are rough estimates, not
                planning data.
              </div>
            </div>
          )}
        </div>

        <LineGroups />

        <div>
          <div className="label mb-1">Caption</div>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Add a caption…"
            value={system.meta.caption ?? ''}
            onFocus={beginDrag}
            onBlur={endDrag}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>
      </div>

      <div className="px-4 py-2 border-t border-line text-[10px] text-muted">
        Click map: add station (or waypoint in waypoint mode) · Click a line: add waypoint ·
        Click a station: select · Drag to move · ⌘S save
      </div>
    </div>
  )
}
