import type * as maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import type { LngLat } from '../geo/curves'
import { haversineKm } from '../geo/curves'
import { SRC_VEHICLES } from './layers'

const SPEED_FACTOR = 90 // vehicles run faster than real life so motion is visible

interface Track {
  color: string
  coords: LngLat[]
  cum: number[] // cumulative km at each vertex
  total: number
  kmh: number
  offset: number
}

function interp(track: Track, d: number): LngLat {
  const { coords, cum } = track
  if (d <= 0) return coords[0]
  if (d >= track.total) return coords[coords.length - 1]
  let i = 1
  while (i < cum.length && cum[i] < d) i++
  const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
  const a = coords[i - 1]
  const b = coords[i]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

export class VehicleAnimator {
  private map: maplibregl.Map
  private tracks: Track[] = []
  private raf = 0
  private startTs = 0
  private running = false

  constructor(map: maplibregl.Map) {
    this.map = map
  }

  setTracks(items: { color: string; coords: LngLat[]; kmh: number }[]) {
    this.tracks = items
      .filter((it) => it.coords.length >= 2)
      .map((it, i) => {
        const cum = [0]
        for (let k = 1; k < it.coords.length; k++) {
          cum.push(cum[k - 1] + haversineKm(it.coords[k - 1], it.coords[k]))
        }
        return {
          color: it.color,
          coords: it.coords,
          cum,
          total: cum[cum.length - 1],
          kmh: it.kmh * SPEED_FACTOR,
          offset: (i * 0.37) % 1, // desynchronize
        }
      })
      .filter((t) => t.total > 0)
  }

  start() {
    if (this.running) return
    this.running = true
    this.startTs = performance.now()
    const loop = (ts: number) => {
      if (!this.running) return
      this.tick(ts)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
    const src = this.map.getSource(SRC_VEHICLES) as maplibregl.GeoJSONSource | undefined
    src?.setData({ type: 'FeatureCollection', features: [] })
  }

  private tick(ts: number) {
    const src = this.map.getSource(SRC_VEHICLES) as maplibregl.GeoJSONSource | undefined
    if (!src) return
    const elapsed = (ts - this.startTs) / 3600000 // hours
    const features: Feature[] = []
    for (const tr of this.tracks) {
      let d = (elapsed * tr.kmh + tr.offset * tr.total) % (2 * tr.total)
      if (d > tr.total) d = 2 * tr.total - d // ping-pong
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: interp(tr, d) },
        properties: { color: tr.color },
      })
    }
    src.setData({ type: 'FeatureCollection', features } satisfies FeatureCollection)
  }
}
