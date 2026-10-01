import type { FeatureCollection, Feature } from 'geojson'
import type { MapPoint, SystemMap } from '../types'
import { linePaths, pathCoords, isLoop, stopIds } from '../geo/stats'
import { smoothPath } from '../geo/curves'

export interface GeoBundle {
  lines: FeatureCollection
  stations: FeatureCollection
  waypoints: FeatureCollection
  interchangeLinks: FeatureCollection
}

/** Count in how many lines each point is a stop (not a waypoint). */
function lineUsage(sys: SystemMap): Map<string, number> {
  const usage = new Map<string, number>()
  for (const line of Object.values(sys.lines)) {
    for (const id of stopIds(line)) {
      usage.set(id, (usage.get(id) ?? 0) + 1)
    }
  }
  return usage
}

export function buildGeo(
  sys: SystemMap,
  selectedStationId: string | null,
  selectedLineId: string | null,
): GeoBundle {
  const lines: Feature[] = []
  const stations: Feature[] = []
  const waypoints: Feature[] = []
  const interchangeLinks: Feature[] = []

  const usage = lineUsage(sys)
  const inInterchange = new Set(
    Object.values(sys.interchanges).flatMap((ic) => ic.stationIds),
  )

  for (const line of Object.values(sys.lines)) {
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

  for (const ic of Object.values(sys.interchanges)) {
    const pts = ic.stationIds.map((id) => sys.stations[id]).filter(Boolean) as MapPoint[]
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

  for (const p of Object.values(sys.stations)) {
    const transfer = (usage.get(p.id) ?? 0) > 1 || inInterchange.has(p.id)
    const isStationLike = !!p.name || (usage.get(p.id) ?? 0) > 1 || inInterchange.has(p.id)
    const feature: Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        name: p.name ?? '',
        transfer: transfer ? 1 : 0,
        selected: p.id === selectedStationId ? 1 : 0,
      },
    }
    if (isStationLike) stations.push(feature)
    else waypoints.push(feature)
  }

  return {
    lines: { type: 'FeatureCollection', features: lines },
    stations: { type: 'FeatureCollection', features: stations },
    waypoints: { type: 'FeatureCollection', features: waypoints },
    interchangeLinks: { type: 'FeatureCollection', features: interchangeLinks },
  }
}
