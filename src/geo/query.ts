import type { Line, MapPoint, SystemMap } from '../types'
import { allPointIds, isLoop, linePaths } from './stats'
import { bearingDeg, haversineKm } from './curves'

/** Lines whose paths (trunk or branches) contain the point. */
export function linesThrough(sys: SystemMap, pointId: string): Line[] {
  return Object.values(sys.lines).filter((line) =>
    linePaths(line).some((ids) => ids.includes(pointId)),
  )
}

/**
 * If the point is a terminus of some line path, describe which end.
 * Prefers the currently selected line when it qualifies.
 */
export function terminusRole(
  sys: SystemMap,
  pointId: string,
  preferLineId?: string | null,
): { lineId: string; branchIndex: number | null; end: 'start' | 'end' } | null {
  const candidates = preferLineId
    ? [sys.lines[preferLineId], ...Object.values(sys.lines).filter((l) => l.id !== preferLineId)]
    : Object.values(sys.lines)
  for (const line of candidates) {
    if (!line) continue
    if (line.stationIds[0] === pointId && line.stationIds.length > 0)
      return { lineId: line.id, branchIndex: null, end: 'start' }
    if (line.stationIds[line.stationIds.length - 1] === pointId)
      return { lineId: line.id, branchIndex: null, end: 'end' }
    const branches = line.branches ?? []
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i]
      if (b.stationIds.length && b.stationIds[b.stationIds.length - 1] === pointId)
        return { lineId: line.id, branchIndex: i, end: 'end' }
    }
  }
  return null
}

/**
 * Index in the line's trunk where inserting the point causes the smallest
 * direction change (port of MetroDreamin's getIndexForSmallestAngleDelta).
 */
export function bestInsertIndex(sys: SystemMap, line: Line, point: MapPoint): number {
  const ids = line.stationIds
  if (ids.length <= 1) return 0

  // distance of the tenth closest point, or the median distance when <20
  const distances = ids
    .map((sId) => {
      const p = sys.stations[sId]
      return p ? haversineKm([point.lng, point.lat], [p.lng, p.lat]) : Number.MAX_SAFE_INTEGER
    })
    .sort((a, b) => a - b)
  const upperDist = distances[Math.min(9, Math.floor((distances.length - 1) / 2))]

  let targetIndex = 0
  let bestMatchValue = 2 // 180deg, furthest station
  for (let index = 0; index <= ids.length; index++) {
    let first: MapPoint | undefined
    let second: MapPoint | undefined
    let third: MapPoint | undefined
    let distance: number

    if (index === 0) {
      // angle formed by new__i__i+1
      first = point
      second = sys.stations[ids[0]]
      third = sys.stations[ids[1]]
      distance = second ? haversineKm([first.lng, first.lat], [second.lng, second.lat]) : 0
    } else if (index === ids.length) {
      // angle formed by i-1__i__new
      first = sys.stations[ids[index - 2]]
      second = sys.stations[ids[index - 1]]
      third = point
      distance = second ? haversineKm([second.lng, second.lat], [third.lng, third.lat]) : 0
    } else {
      // angle formed by i-1__new__i
      first = sys.stations[ids[index - 1]]
      second = point
      third = sys.stations[ids[index]]
      distance = Math.min(
        first ? haversineKm([first.lng, first.lat], [second.lng, second.lat]) : Infinity,
        third ? haversineKm([second.lng, second.lat], [third.lng, third.lat]) : Infinity,
      )
    }
    if (!first || !second || !third) continue

    const b1 = bearingDeg([first.lng, first.lat], [second.lng, second.lat])
    const b2 = bearingDeg([second.lng, second.lat], [third.lng, third.lat])
    let angleDiff = Math.abs(b1 - b2) % 360
    angleDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff

    // ratio between angle delta and max 180deg, plus relative distance; lower wins
    const matchValue = angleDiff / 180 + distance / upperDist
    if (matchValue <= bestMatchValue) {
      targetIndex = index
      bestMatchValue = matchValue
    }
  }
  return targetIndex
}

/** Up to `n` lines that don't pass through the point, nearest first. */
export function nearestLines(
  sys: SystemMap,
  pointId: string,
  n: number,
  preferId?: string | null,
): Line[] {
  const p = sys.stations[pointId]
  if (!p) return []
  const on = new Set(linesThrough(sys, pointId).map((l) => l.id))
  const lines = Object.values(sys.lines)
    .filter((l) => !on.has(l.id))
    .map((l) => {
      let d = Infinity
      for (const id of allPointIds(l)) {
        const q = sys.stations[id]
        if (q) d = Math.min(d, haversineKm([p.lng, p.lat], [q.lng, q.lat]))
      }
      return { l, d }
    })
    .sort((a, b) => a.d - b.d)
    .map((s) => s.l)
  const preferred = preferId ? lines.findIndex((l) => l.id === preferId) : -1
  if (preferred > 0) lines.unshift(lines.splice(preferred, 1)[0])
  return lines.slice(0, n)
}

/** Whether makeLoop can close the line's trunk on this point (MD's rule). */
export function canMakeLoop(line: Line, pointId: string): boolean {
  const ids = line.stationIds
  const count = ids.reduce((n, id) => n + (id === pointId ? 1 : 0), 0)
  const position = ids.indexOf(pointId)
  return (
    count === 1 &&
    ids.length >= 3 &&
    position !== 1 &&
    position !== ids.length - 2 &&
    !isLoop(line)
  )
}
