import type * as maplibregl from 'maplibre-gl'
import type { ActivePath, Line, SystemMap } from '../types'
import { linePaths } from './stats'
import { nearestOnPolyline } from './curves'

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

export interface SegmentHit {
  lineId: string
  branchIndex: number | null
  /** Index at which to splice the new point into trunk stationIds / branch stationIds. */
  insertIndex: number
  lng: number
  lat: number
  distPx: number
}

/** Nearest polyline segment to a click, measured in screen pixels. */
export function nearestSegment(
  sys: SystemMap,
  map: maplibregl.Map,
  lngLat: { lng: number; lat: number },
): SegmentHit | null {
  const p = map.project([lngLat.lng, lngLat.lat])
  let best: SegmentHit | null = null

  const check = (line: Line, ids: string[], branchIndex: number | null, isBranch: boolean) => {
    const xy = ids
      .map((id) => sys.stations[id])
      .filter(Boolean)
      .map((st) => {
        const q = map.project([st.lng, st.lat])
        return { x: q.x, y: q.y }
      })
    const hit = nearestOnPolyline({ x: p.x, y: p.y }, xy)
    if (!hit) return
    // trunk: segment i → splice at i+1. branch path=[root,...ids]: segment i → splice at i
    const insertIndex = isBranch ? hit.index : hit.index + 1
    const lngLatPt = map.unproject([hit.point.x, hit.point.y])
    if (!best || hit.dist < best.distPx) {
      best = {
        lineId: line.id,
        branchIndex,
        insertIndex,
        lng: lngLatPt.lng,
        lat: lngLatPt.lat,
        distPx: hit.dist,
      }
    }
  }

  for (const line of Object.values(sys.lines)) {
    check(line, line.stationIds, null, false)
    ;(line.branches ?? []).forEach((b, i) => {
      check(line, [b.rootStationId, ...b.stationIds], i, true)
    })
  }
  return best
}

/** Point id at the drawing end of an ActivePath (branch root for empty branches). */
export function activePathEndId(sys: SystemMap, ap: ActivePath): string | null {
  const line = sys.lines[ap.lineId]
  if (!line) return null
  if (ap.branchIndex == null) {
    const ids = line.stationIds
    return (ap.end === 'end' ? ids[ids.length - 1] : ids[0]) ?? null
  }
  const b = line.branches?.[ap.branchIndex]
  if (!b) return null
  return ap.end === 'end' ? (b.stationIds[b.stationIds.length - 1] ?? b.rootStationId) : b.rootStationId
}

/** Last (or first) point coordinate of an ActivePath — used for the draw preview. */
export function pathEndpoint(
  sys: SystemMap,
  lineId: string,
  branchIndex: number | null,
  end: 'start' | 'end',
): { lng: number; lat: number } | null {
  const line = sys.lines[lineId]
  if (!line) return null
  const ids =
    branchIndex == null ? line.stationIds : (line.branches?.[branchIndex]?.stationIds ?? [])
  if (branchIndex != null && ids.length === 0) {
    const root = line.branches?.[branchIndex]?.rootStationId
    const p = root ? sys.stations[root] : undefined
    return p ? { lng: p.lng, lat: p.lat } : null
  }
  const id = end === 'end' ? ids[ids.length - 1] : ids[0]
  const p = id ? sys.stations[id] : undefined
  return p ? { lng: p.lng, lat: p.lat } : null
}
