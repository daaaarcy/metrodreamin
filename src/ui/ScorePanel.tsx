import { useStore, useSystem } from '../state/store'
import { lineStats, systemStats, fmtKm, fmtMin, fmtMoney, fmtRidership } from '../geo/stats'
import { MODE_BY_ID } from '../data/modes'

export function ScorePanel() {
  const system = useSystem()
  const open = useStore((s) => s.scoreOpen)
  const setOpen = useStore((s) => s.setScoreOpen)
  const selectLine = useStore((s) => s.selectLine)

  if (!open || !system) return null

  const sys = systemStats(system)
  const lines = Object.values(system.lines)

  return (
    <div className="absolute right-3 top-16 bottom-4 w-72 panel z-10 flex flex-col overflow-hidden">
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <span className="label">Score & stats</span>
        <button className="btn text-xs" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-lg px-3 py-2.5 flex items-baseline justify-between">
          <span className="text-xs font-medium opacity-80">Map score</span>
          <span className="text-2xl font-bold">{sys.score.toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-3 pb-2 text-center">
        <div className="bg-black/5 rounded-lg py-1.5">
          <div className="text-sm font-semibold">{sys.lines}</div>
          <div className="label">Lines</div>
        </div>
        <div className="bg-black/5 rounded-lg py-1.5">
          <div className="text-sm font-semibold">
            {Object.values(system.stations).filter((p) => p.name).length}
          </div>
          <div className="label">Stations</div>
        </div>
        <div className="bg-black/5 rounded-lg py-1.5">
          <div className="text-sm font-semibold">{sys.interchanges}</div>
          <div className="label">Transfers</div>
        </div>
        <div className="bg-black/5 rounded-lg py-1.5">
          <div className="text-sm font-semibold">{fmtKm(sys.lengthKm)}</div>
          <div className="label">Track</div>
        </div>
        <div className="bg-black/5 rounded-lg py-1.5">
          <div className="text-sm font-semibold">{fmtMoney(sys.costMUsd)}</div>
          <div className="label">Cost</div>
        </div>
        <div className="bg-black/5 rounded-lg py-1.5">
          <div className="text-sm font-semibold">{fmtRidership(sys.dailyRidership)}</div>
          <div className="label">Ridership</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        <div className="label">Per line</div>
        {lines.map((l) => {
          const s = lineStats(system, l)
          return (
            <button
              key={l.id}
              className="w-full text-left px-2.5 py-2 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] cursor-pointer"
              onClick={() => selectLine(l.id)}
            >
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                <span className="truncate flex-1">{l.name}</span>
                <span className="text-black/35 text-xs font-normal">
                  {MODE_BY_ID[l.mode].emoji}
                </span>
              </div>
              <div className="text-[11px] text-black/50 mt-0.5">
                {fmtKm(s.lengthKm)} · {fmtMin(s.rideMin)} · {fmtMoney(s.costMUsd)} ·{' '}
                {fmtRidership(s.dailyRidership)}
              </div>
            </button>
          )
        })}
        {lines.length === 0 && (
          <div className="text-xs text-black/40">Draw some lines to see stats.</div>
        )}
        <div className="text-[10px] text-black/35 pt-1">
          Costs use mode-based $/km with grade multipliers (elevated ×1.6, underground ×3.2).
          Ridership is a per-stop heuristic. Both are rough estimates, not planning data.
        </div>
      </div>
    </div>
  )
}
