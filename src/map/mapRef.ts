import { LngLatBounds } from 'maplibre-gl'
import type * as maplibregl from 'maplibre-gl'

/** Global handle so UI components (search, dialogs) can move the camera. */
export const mapApi: { map: maplibregl.Map | null } = { map: null }

// debug/test handle
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__mapApi = mapApi
}

export function flyTo(lng: number, lat: number, zoom = 12) {
  mapApi.map?.flyTo({ center: [lng, lat], zoom, duration: 1200 })
}

/** Frame the given points (e.g. after a map import). No-op when empty. */
export function fitPoints(points: { lng: number; lat: number }[]) {
  const map = mapApi.map
  if (!map || !points.length) return
  const bounds = new LngLatBounds()
  for (const p of points) bounds.extend([p.lng, p.lat])
  map.fitBounds(bounds, { padding: 60, duration: 1200 })
}
