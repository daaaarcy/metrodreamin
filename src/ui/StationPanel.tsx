import { useStore, useSystem } from '../state/store'
import type { Grade } from '../types'
import { canMakeLoop, linesThrough, nearestLines, terminusRole } from '../geo/query'
import { MODE_BY_ID } from '../data/modes'
import { useEffect, useRef, useState } from 'react'

export function StationPanel({ stationId }: { stationId: string }) {
  const system = useSystem()
  const selectStation = useStore((st) => st.selectStation)
  const renamePoint = useStore((st) => st.renamePoint)
  const setGrade = useStore((st) => st.setGrade)
  const deletePoint = useStore((st) => st.deletePoint)
  const convertPoint = useStore((st) => st.convertPoint)
  const toggleLineWaypoint = useStore((st) => st.toggleLineWaypoint)
  const removeFromLine = useStore((st) => st.removeFromLine)
  const forkLine = useStore((st) => st.forkLine)
  const addToLine = useStore((st) => st.addToLine)
  const makeLoop = useStore((st) => st.makeLoop)
  const recentLineId = useStore((st) => st.recentLineId)
  const pendingInterchangeFrom = useStore((st) => st.pendingInterchangeFrom)
  const setPendingInterchange = useStore((st) => st.setPendingInterchange)
  const removeFromInterchange = useStore((st) => st.removeFromInterchange)
  const selectLine = useStore((st) => st.selectLine)
  const addLine = useStore((st) => st.addLine)
  const beginDrag = useStore((st) => st.beginDrag)
  const endDrag = useStore((st) => st.endDrag)
  const nameRef = useRef<HTMLInputElement>(null)
  const [showAll, setShowAll] = useState(false)

  const p = system?.stations[stationId]

  // focus the name field when a fresh (unnamed) station is selected
  useEffect(() => {
    if (p && !p.name && !p.waypoint) nameRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId])

  if (!system || !p) return null

  const lines = linesThrough(system, stationId)
  const interchange = Object.values(system.interchanges).find((ic) =>
    ic.stationIds.includes(stationId),
  )
  const isTerminus = lines.some((l) => terminusRole(system, stationId, l.id))
  const isWaypoint = !!p.waypoint
  const addable = nearestLines(system, stationId, Infinity, recentLineId)
  const shown = showAll ? addable : addable.slice(0, 5)
  const loopable = lines.filter((l) => canMakeLoop(l, stationId))

  return (
    <div className="absolute left-3 top-16 bottom-4 w-80 panel z-10 flex flex-col overflow-hidden">
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <button className="btn text-xs" onClick={() => selectStation(null)}>
          ←
        </button>
        <span className="label flex-1">{isWaypoint ? 'Waypoint' : 'Station'}</span>
        {isTerminus && <span className="chip bg-subtle text-muted">terminus</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
        {isWaypoint ? (
          <div className="text-xs text-muted">Waypoints shape a line but aren't stops.</div>
        ) : (
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
          </div>
        )}

        <button className="btn w-full text-xs" onClick={() => convertPoint(stationId, !isWaypoint)}>
          {isWaypoint ? 'Convert to station' : 'Convert to waypoint'}
        </button>

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
                className={`btn flex-1 text-xs ${(p.grade ?? 'at') === g ? 'is-on' : ''}`}
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
                    className="flex items-center gap-1.5 flex-1 text-left hover:bg-hover rounded-md px-1 py-0.5 cursor-pointer"
                    onClick={() => selectLine(l.id)}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-line shrink-0"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="truncate">{l.name}</span>
                    <span className="text-muted text-xs">{MODE_BY_ID[l.mode].emoji}</span>
                  </button>
                  {!isWaypoint && (
                    <>
                      <button
                        className={`text-[11px] px-1.5 py-0.5 rounded cursor-pointer ${isWpForLine ? 'chip-warn' : 'bg-subtle text-muted'}`}
                        title="Toggle whether this line stops here"
                        onClick={() => toggleLineWaypoint(l.id, stationId)}
                      >
                        {isWpForLine ? 'waypoint' : 'stop'}
                      </button>
                      <button
                        className="text-[11px] px-1.5 py-0.5 rounded bg-subtle text-muted hover:bg-red-500/15 hover:text-red-500 cursor-pointer"
                        title={`Remove this point from ${l.name} (keeps the station)`}
                        onClick={() => removeFromLine(l.id, stationId)}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              )
            })}
            {lines.length === 0 && (
              <div className="text-xs text-muted">Orphaned — not on any line.</div>
            )}
          </div>
        </div>

        {shown.length > 0 && (
          <div>
            <div className="label mb-1">Add to line</div>
            <div className="space-y-1">
              {shown.map((l) => (
                <button
                  key={l.id}
                  className="w-full flex items-center gap-1.5 text-left text-sm hover:bg-hover rounded-md px-1 py-0.5 cursor-pointer"
                  onClick={() => addToLine(l.id, stationId)}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-line shrink-0"
                    style={{ backgroundColor: l.color }}
                  />
                  Add to {l.name}
                </button>
              ))}
              {addable.length > 5 && (
                <button
                  className="text-xs text-muted hover:text-fg px-1 cursor-pointer"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show fewer' : `Show all (${addable.length})`}
                </button>
              )}
            </div>
          </div>
        )}

        {loopable.map((l) => (
          <button
            key={l.id}
            className="btn w-full text-xs"
            onClick={() => makeLoop(l.id, stationId)}
          >
            Make loop in {l.name}
          </button>
        ))}

        {!isWaypoint && (
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
                        className="text-[11px] px-1.5 py-0.5 rounded bg-subtle hover:bg-hover cursor-pointer"
                        onClick={() => removeFromInterchange(interchange.id, id)}
                      >
                        unlink
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-xs text-muted">None</div>
            )}
            <button
              className={`btn w-full mt-1.5 text-xs ${pendingInterchangeFrom === stationId ? 'chip-warn' : ''}`}
              onClick={() =>
                setPendingInterchange(pendingInterchangeFrom === stationId ? null : stationId)
              }
            >
              {pendingInterchangeFrom === stationId
                ? 'Click another station to link… (tap to cancel)'
                : '+ Add walking transfer'}
            </button>
          </div>
        )}

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
