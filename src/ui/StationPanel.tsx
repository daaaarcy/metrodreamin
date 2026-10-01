import { useStore, useSystem } from '../state/store'
import type { Grade } from '../types'
import { linesThrough, terminusRole } from '../geo/query'
import { MODE_BY_ID } from '../data/modes'
import { useEffect, useRef } from 'react'

export function StationPanel({ stationId }: { stationId: string }) {
  const system = useSystem()
  const selectStation = useStore((st) => st.selectStation)
  const renamePoint = useStore((st) => st.renamePoint)
  const setGrade = useStore((st) => st.setGrade)
  const deletePoint = useStore((st) => st.deletePoint)
  const toggleLineWaypoint = useStore((st) => st.toggleLineWaypoint)
  const removeFromLine = useStore((st) => st.removeFromLine)
  const forkLine = useStore((st) => st.forkLine)
  const pendingInterchangeFrom = useStore((st) => st.pendingInterchangeFrom)
  const setPendingInterchange = useStore((st) => st.setPendingInterchange)
  const removeFromInterchange = useStore((st) => st.removeFromInterchange)
  const selectLine = useStore((st) => st.selectLine)
  const addLine = useStore((st) => st.addLine)
  const beginDrag = useStore((st) => st.beginDrag)
  const endDrag = useStore((st) => st.endDrag)
  const nameRef = useRef<HTMLInputElement>(null)

  const p = system?.stations[stationId]

  // focus the name field when a fresh (unnamed) station is selected
  useEffect(() => {
    if (p && !p.name) nameRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId])

  if (!system || !p) return null

  const lines = linesThrough(system, stationId)
  const interchange = Object.values(system.interchanges).find((ic) =>
    ic.stationIds.includes(stationId),
  )
  const isTerminus = lines.some((l) => terminusRole(system, stationId, l.id))
  const isWaypoint = !p.name

  return (
    <div className="absolute left-3 top-16 bottom-4 w-80 panel z-10 flex flex-col overflow-hidden">
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <button className="btn text-xs" onClick={() => selectStation(null)}>
          ←
        </button>
        <span className="label flex-1">{isWaypoint ? 'Waypoint' : 'Station'}</span>
        {isTerminus && <span className="chip bg-black/5 text-black/60">terminus</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
        <div>
          <div className="label mb-1">Name</div>
          <input
            ref={nameRef}
            className="input"
            placeholder="Name this station…"
            defaultValue={p.name ?? ''}
            key={stationId}
            onFocus={beginDrag}
            onBlur={endDrag}
            onChange={(e) => renamePoint(stationId, e.target.value)}
          />
          {isWaypoint && (
            <div className="text-[11px] text-black/45 mt-1">
              Unnamed points act as waypoints — they shape the line but aren't stops.
            </div>
          )}
        </div>

        <div>
          <div className="label mb-1">Grade</div>
          <div className="flex gap-1">
            {(
              [
                ['at', 'At grade'],
                ['above', 'Elevated'],
                ['below', 'Underground'],
              ] as [Grade, string][]
            ).map(([g, label]) => (
              <button
                key={g}
                className={`btn flex-1 text-xs ${(p.grade ?? 'at') === g ? 'bg-blue-100 text-blue-800' : ''}`}
                onClick={() => setGrade(stationId, g)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label mb-1">Lines here</div>
          <div className="space-y-1">
            {lines.map((l) => {
              const isWpForLine = (l.waypointOverrides ?? []).includes(stationId)
              return (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <button
                    className="flex items-center gap-1.5 flex-1 text-left hover:bg-black/5 rounded-md px-1 py-0.5 cursor-pointer"
                    onClick={() => selectLine(l.id)}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="truncate">{l.name}</span>
                    <span className="text-black/35 text-xs">{MODE_BY_ID[l.mode].emoji}</span>
                  </button>
                  <button
                    className={`text-[11px] px-1.5 py-0.5 rounded cursor-pointer ${isWpForLine ? 'bg-amber-100 text-amber-800' : 'bg-black/5 text-black/50'}`}
                    title="Toggle whether this line stops here"
                    onClick={() => toggleLineWaypoint(l.id, stationId)}
                  >
                    {isWpForLine ? 'waypoint' : 'stop'}
                  </button>
                  <button
                    className="text-[11px] px-1.5 py-0.5 rounded bg-black/5 text-black/50 hover:bg-red-100 hover:text-red-700 cursor-pointer"
                    title={`Remove this point from ${l.name} (keeps the station)`}
                    onClick={() => removeFromLine(l.id, stationId)}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
            {lines.length === 0 && (
              <div className="text-xs text-black/40">Orphaned — not on any line.</div>
            )}
          </div>
        </div>

        <div>
          <div className="label mb-1">Walking transfers</div>
          {interchange ? (
            <div className="space-y-1">
              {interchange.stationIds
                .filter((id) => id !== stationId)
                .map((id) => (
                  <div key={id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">
                      {system.stations[id]?.name || 'unnamed station'}
                    </span>
                    <button
                      className="text-[11px] px-1.5 py-0.5 rounded bg-black/5 hover:bg-black/10 cursor-pointer"
                      onClick={() => removeFromInterchange(interchange.id, id)}
                    >
                      unlink
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-xs text-black/40">None</div>
          )}
          <button
            className={`btn w-full mt-1.5 text-xs ${pendingInterchangeFrom === stationId ? 'bg-amber-100 text-amber-800' : ''}`}
            onClick={() =>
              setPendingInterchange(pendingInterchangeFrom === stationId ? null : stationId)
            }
          >
            {pendingInterchangeFrom === stationId
              ? 'Click another station to link… (tap to cancel)'
              : '+ Add walking transfer'}
          </button>
        </div>

        <button
          className="btn w-full text-xs"
          title="Create a new line starting at this point"
          onClick={() => addLine(stationId)}
        >
          ＋ Start new line from here
        </button>

        <div className="flex gap-1.5">
          {lines.map((l) => {
            const term = terminusRole(system, stationId, l.id)
            if (term) return null
            return (
              <button
                key={l.id}
                className="btn flex-1 text-xs"
                title={`Start a branch of ${l.name} from here`}
                onClick={() => forkLine(l.id, stationId)}
              >
                ⑂ Branch {l.name}
              </button>
            )
          })}
        </div>

        <button
          className="btn btn-danger w-full text-xs"
          onClick={() => {
            if (confirm('Delete this point?')) deletePoint(stationId)
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
