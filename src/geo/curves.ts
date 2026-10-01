export type LngLat = [number, number]

const R = 6378137
const MAX_LAT = 85.051129

/** WGS84 → Web Mercator meters. */
export function toMerc(lng: number, lat: number): { x: number; y: number } {
  const clat = Math.max(Math.min(lat, MAX_LAT), -MAX_LAT)
  return {
    x: (R * lng * Math.PI) / 180,
    y: R * Math.log(Math.tan(Math.PI / 4 + (clat * Math.PI) / 360)),
  }
}

export function fromMerc(x: number, y: number): LngLat {
  const lng = (x / R) * (180 / Math.PI)
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)
  return [lng, lat]
}

/**
 * Catmull-Rom spline through every control point (uniform parameterization),
 * sampled in Web Mercator space so curves look right on the map.
 * Pass `closed` when the path is a loop (first point id === last point id).
 */
export function smoothPath(coords: LngLat[], closed = false, samplesPerSeg = 12): LngLat[] {
  if (coords.length < 3) return coords

  let pts = coords.map(([lng, lat]) => toMerc(lng, lat))
  if (closed && pts.length > 1) pts = pts.slice(0, -1) // drop duplicated closing point
  if (pts.length < 3) return coords

  const out: { x: number; y: number }[] = []
  const n = pts.length
  const segCount = closed ? n : n - 1

  const at = (i: number) =>
    closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]

  for (let i = 0; i < segCount; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    for (let j = 0; j < samplesPerSeg; j++) {
      const t = j / samplesPerSeg
      const t2 = t * t
      const t3 = t2 * t
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  if (!closed) out.push(pts[n - 1])

  return out.map((p) => fromMerc(p.x, p.y))
}

/** Great-circle distance in km. */
export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(s))
}

export function pathLengthKm(coords: LngLat[], closed = false): number {
  let sum = 0
  for (let i = 1; i < coords.length; i++) sum += haversineKm(coords[i - 1], coords[i])
  if (closed && coords.length > 2) sum += haversineKm(coords[coords.length - 1], coords[0])
  return sum
}

interface XY {
  x: number
  y: number
}

/** Closest segment of a polyline to point p, in screen/mercator xy space. */
export function nearestOnPolyline(
  p: XY,
  polyline: XY[],
): { index: number; t: number; point: XY; dist: number } | null {
  let best: { index: number; t: number; point: XY; dist: number } | null = null
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i]
    const b = polyline[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    const q = { x: a.x + dx * t, y: a.y + dy * t }
    const dist = Math.hypot(p.x - q.x, p.y - q.y)
    if (!best || dist < best.dist) best = { index: i, t, point: q, dist }
  }
  return best
}
