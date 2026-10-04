import type { FeatureCollection, Feature } from 'geojson'
import type { MapPoint, SystemMap } from '../types'
import { linePaths, pathCoords, isLoop, stopIds, allPointIds } from '../geo/stats'
import { smoothPath } from '../geo/curves'

export interface GeoBundle {
  lines: FeatureCollection
  stations: FeatureCollection
  waypoints: FeatureCollection
  interchangeLinks: FeatureCollection
}

export function buildGeo(
  sys: SystemMap,
  selectedStationId: string | null,
  selectedLineId: string | null,
  hiddenLineIds: Set<string>,
): GeoBundle {
  const lines: Feature[] = []
  const stations: Feature[] = []
  const waypoints: Feature[] = []
  const interchangeLinks: Feature[] = []

  // stop usage counts only visible lines (hidden groups don't create transfers)
  const usage = new Map<string, number>()
  // how many lines (any / visible-only) each point belongs to
  const onLines = new Map<string, number>()
  const onVisible = new Map<string, number>()
  for (const line of Object.values(sys.lines)) {
    const hidden = hiddenLineIds.has(line.id)
    if (!hidden) {
      for (const id of stopIds(sys, line)) {
        usage.set(id, (usage.get(id) ?? 0) + 1)
      }
    }
    for (const id of new Set(allPointIds(line))) {
      onLines.set(id, (onLines.get(id) ?? 0) + 1)
      if (!hidden) onVisible.set(id, (onVisible.get(id) ?? 0) + 1)
    }
  }
  const inInterchange = new Set(
    Object.values(sys.interchanges).flatMap((ic) => ic.stationIds),
  )

  for (const line of Object.values(sys.lines)) {
    if (hiddenLineIds.has(line.id)) continue
    const paths = linePaths(line)
    paths.forEach((ids, idx) => {
      const coords = pathCoords(sys, ids)
      if (coords.length < 2) return
      const closed = idx === 0 && isLoop(line)
      const geometry = { type: 'LineString' as const, coordinates: smoothPath(coords, closed) }
      lines.push({
        type: 'Feature',
        geometry,
        properties: {
          lineId: line.id,
          color: line.color,
          icon: line.icon ?? 'solid',
          name: idx === 0 ? line.name : '',
          selected: line.id === selectedLineId ? 1 : 0,
        },
      })
    })
  }

  const shown = new Set<string>()
  for (const p of Object.values(sys.stations)) {
    // a point whose lines are all hidden is skipped, unless it's selected
    if ((onLines.get(p.id) ?? 0) > 0 && (onVisible.get(p.id) ?? 0) === 0 && p.id !== selectedStationId) {
      continue
    }
    shown.add(p.id)
    if (p.waypoint) {
      waypoints.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { id: p.id, selected: p.id === selectedStationId ? 1 : 0 },
      })
      continue
    }
    const transfer = (usage.get(p.id) ?? 0) > 1 || inInterchange.has(p.id)
    stations.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        name: p.name ?? '',
        transfer: transfer ? 1 : 0,
        selected: p.id === selectedStationId ? 1 : 0,
      },
    })
  }

  for (const ic of Object.values(sys.interchanges)) {
    const pts = ic.stationIds
      .map((id) => sys.stations[id])
      .filter((p): p is MapPoint => !!p && shown.has(p.id))
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        interchangeLinks.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [pts[i].lng, pts[i].lat],
              [pts[j].lng, pts[j].lat],
            ],
          },
          properties: { id: ic.id },
        })
      }
    }
  }

  return {
    lines: { type: 'FeatureCollection', features: lines },
    stations: { type: 'FeatureCollection', features: stations },
    waypoints: { type: 'FeatureCollection', features: waypoints },
    interchangeLinks: { type: 'FeatureCollection', features: interchangeLinks },
  }
}
