import type { Line, SystemMap } from '../types'
import { MODE_BY_ID } from '../data/modes'
import { haversineKm } from './curves'
import type { LngLat } from './curves'

/** All drawable paths of a line: trunk plus each branch (root prepended). */
export function linePaths(line: Line): string[][] {
  const paths = [line.stationIds]
  for (const b of line.branches ?? []) {
    paths.push([b.rootStationId, ...b.stationIds])
  }
  return paths
}

export function pathCoords(sys: SystemMap, ids: string[]): LngLat[] {
  return ids
    .map((id) => sys.stations[id])
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => [p.lng, p.lat])
}

export function isLoop(line: Line): boolean {
  return (
    line.stationIds.length > 2 && line.stationIds[0] === line.stationIds[line.stationIds.length - 1]
  )
}

/** Ids the line stops at (excludes waypoints and per-line waypoint overrides). */
export function stopIds(sys: SystemMap, line: Line): Set<string> {
  const overrides = new Set(line.waypointOverrides ?? [])
  const ids = new Set<string>()
  for (const path of linePaths(line)) {
    for (const id of path) {
      if (overrides.has(id) || sys.stations[id]?.waypoint) continue
      ids.add(id)
    }
  }
  return ids
}

/** Every point id referenced by the line, stops + waypoints. */
export function allPointIds(line: Line): string[] {
  const ids = [...line.stationIds]
  for (const b of line.branches ?? []) ids.push(...b.stationIds)
  return ids
}

const GRADE_FACTOR = { at: 1, above: 1.6, below: 3.2 } as const

export interface LineStats {
  lengthKm: number
  rideMin: number
  costMUsd: number
  dailyRidership: number
  stops: number
  waypoints: number
}

export function lineStats(sys: SystemMap, line: Line): LineStats {
  const mode = MODE_BY_ID[line.mode] ?? MODE_BY_ID.metro
  const overrides = new Set(line.waypointOverrides ?? [])
  let lengthKm = 0
  let costMUsd = 0
  let stops = 0
  let waypoints = 0
  const counted = new Set<string>()

  const paths: { ids: string[]; closed: boolean }[] = [
    { ids: line.stationIds, closed: isLoop(line) },
    ...(line.branches ?? []).map((b) => ({ ids: [b.rootStationId, ...b.stationIds], closed: false })),
  ]

  for (const { ids, closed } of paths) {
    const pts = ids.map((id) => sys.stations[id]).filter(Boolean)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const km = haversineKm([a.lng, a.lat], [b.lng, b.lat])
      lengthKm += km
      const ga = a.grade ?? 'at'
      const gb = b.grade ?? 'at'
      costMUsd += (km * mode.costPerKmM * (GRADE_FACTOR[ga] + GRADE_FACTOR[gb])) / 2
    }
    if (closed && pts.length > 2) {
      const a = pts[pts.length - 1]
      const b = pts[0]
      lengthKm += haversineKm([a.lng, a.lat], [b.lng, b.lat])
    }
    for (const id of ids) {
      if (counted.has(id)) continue
      counted.add(id)
      const p = sys.stations[id]
      if (overrides.has(id) || p?.waypoint) waypoints++
      else stops++
    }
  }

  return {
    lengthKm,
    rideMin: (lengthKm / mode.speedKmh) * 60,
    costMUsd,
    dailyRidership: stops * mode.boardingsPerStop,
    stops,
    waypoints,
  }
}

export interface SystemStats {
  lengthKm: number
  rideMin: number
  costMUsd: number
  dailyRidership: number
  stops: number
  waypoints: number
  interchanges: number
  lines: number
  modes: number
  score: number
}

export function systemStats(sys: SystemMap): SystemStats {
  const agg: SystemStats = {
    lengthKm: 0,
    rideMin: 0,
    costMUsd: 0,
    dailyRidership: 0,
    stops: 0,
    waypoints: 0,
    interchanges: Object.keys(sys.interchanges).length,
    lines: Object.keys(sys.lines).length,
    modes: new Set(Object.values(sys.lines).map((l) => l.mode)).size,
    score: 0,
  }
  const stationCount = Object.values(sys.stations).filter((p) => !p.waypoint).length
  for (const line of Object.values(sys.lines)) {
    const s = lineStats(sys, line)
    agg.lengthKm += s.lengthKm
    agg.rideMin += s.rideMin
    agg.costMUsd += s.costMUsd
    agg.dailyRidership += s.dailyRidership
    agg.stops += s.stops
    agg.waypoints += s.waypoints
  }
  // Transparent heuristic "map score": rewards coverage and connectivity.
  agg.score = Math.round(
    stationCount * 10 + agg.interchanges * 15 + agg.lines * 8 + agg.lengthKm * 2,
  )
  return agg
}

export function fmtKm(km: number): string {
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`
}

export function fmtMin(min: number): string {
  if (min >= 120) return `${(min / 60).toFixed(1)} h`
  return `${Math.round(min)} min`
}

export function fmtMoney(mUsd: number): string {
  if (mUsd >= 1000) return `$${(mUsd / 1000).toFixed(1)}B`
  if (mUsd >= 1) return `$${Math.round(mUsd)}M`
  return `$${(mUsd * 1000).toFixed(0)}K`
}

export function fmtRidership(daily: number): string {
  if (daily >= 1_000_000) return `${(daily / 1_000_000).toFixed(1)}M/day`
  if (daily >= 1000) return `${Math.round(daily / 1000)}K/day`
  return `${Math.round(daily)}/day`
}
