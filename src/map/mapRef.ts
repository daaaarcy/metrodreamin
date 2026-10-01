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
