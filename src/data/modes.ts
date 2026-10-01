import type { ModeId } from '../types'

export interface ModeDef {
  id: ModeId
  label: string
  /** Cruise speed used for ride-time estimates, km/h. */
  speedKmh: number
  /** Construction cost per km of at-grade alignment, USD millions (rough estimate). */
  costPerKmM: number
  /** Rough boardings per stop per day, used for the ridership heuristic. */
  boardingsPerStop: number
  emoji: string
}

export const MODES: ModeDef[] = [
  { id: 'gondola', label: 'Gondola / aerial tram', speedKmh: 16, costPerKmM: 30, boardingsPerStop: 2000, emoji: '🚡' },
  { id: 'bus', label: 'Local bus', speedKmh: 18, costPerKmM: 1, boardingsPerStop: 2500, emoji: '🚌' },
  { id: 'tram', label: 'Tram / streetcar', speedKmh: 22, costPerKmM: 35, boardingsPerStop: 4500, emoji: '🚊' },
  { id: 'ferry', label: 'Ferry', speedKmh: 25, costPerKmM: 0.5, boardingsPerStop: 2500, emoji: '⛴️' },
  { id: 'brt', label: 'Bus rapid transit', speedKmh: 28, costPerKmM: 15, boardingsPerStop: 6000, emoji: '🚎' },
  { id: 'lrt', label: 'Light rail / interurban', speedKmh: 35, costPerKmM: 60, boardingsPerStop: 8000, emoji: '🚈' },
  { id: 'metro', label: 'Metro / rapid transit', speedKmh: 38, costPerKmM: 250, boardingsPerStop: 15000, emoji: '🚇' },
  { id: 'commuter', label: 'Commuter / suburban rail', speedKmh: 55, costPerKmM: 90, boardingsPerStop: 6000, emoji: '🚆' },
  { id: 'regional', label: 'Medium / long distance rail', speedKmh: 90, costPerKmM: 70, boardingsPerStop: 4000, emoji: '🚄' },
  { id: 'hsr', label: 'High speed rail', speedKmh: 200, costPerKmM: 60, boardingsPerStop: 5000, emoji: '🚅' },
  { id: 'airliner', label: 'Airliner', speedKmh: 780, costPerKmM: 5, boardingsPerStop: 8000, emoji: '✈️' },
]

export const MODE_BY_ID: Record<ModeId, ModeDef> = Object.fromEntries(
  MODES.map((m) => [m.id, m]),
) as Record<ModeId, ModeDef>
