// Reverse geocoding for station auto-naming via Nominatim. Requests are
// serialized with >=1.1s spacing to respect the public-API usage policy;
// failures resolve to null and the caller just leaves the point unnamed.

const URL_BASE = 'https://nominatim.openstreetmap.org/reverse'

let chain: Promise<unknown> = Promise.resolve()
let lastAt = 0

export function reverseName(lng: number, lat: number, coarse: boolean): Promise<string | null> {
  const run = async (): Promise<string | null> => {
    const wait = 1100 - (Date.now() - lastAt)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastAt = Date.now()
    try {
      const r = await fetch(
        `${URL_BASE}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=${coarse ? 10 : 17}&accept-language=en`,
      )
      if (!r.ok) return null
      const j = await r.json()
      const a = j?.address ?? {}
      const name = coarse
        ? (a.city ?? a.town ?? a.village ?? a.suburb ?? j?.name)
        : (a.road ?? j?.name ?? a.neighbourhood ?? a.suburb ?? a.city ?? a.town ?? a.village)
      return typeof name === 'string' && name ? name : null
    } catch {
      return null
    }
  }
  const p = chain.then(run, run)
  chain = p
  return p
}
