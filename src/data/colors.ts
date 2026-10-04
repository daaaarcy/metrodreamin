import type { LineIcon } from '../types'

/** MetroDreamin's default line names + colors, in assignment priority order. */
export const DEFAULT_LINES = [
  { name: 'Red Line', color: '#e6194b' },
  { name: 'Green Line', color: '#3cb44b' },
  { name: 'Yellow Line', color: '#ffe119' },
  { name: 'Blue Line', color: '#4363d8' },
  { name: 'Orange Line', color: '#f58231' },
  { name: 'Purple Line', color: '#911eb4' },
  { name: 'Cyan Line', color: '#42d4f4' },
  { name: 'Magenta Line', color: '#f032e6' },
  { name: 'Lime Line', color: '#bfef45' },
  { name: 'Pink Line', color: '#fabebe' },
  { name: 'Teal Line', color: '#469990' },
  { name: 'Lavender Line', color: '#e6beff' },
  { name: 'Brown Line', color: '#9a6324' },
  { name: 'Beige Line', color: '#fffac8' },
  { name: 'Maroon Line', color: '#800000' },
  { name: 'Mint Line', color: '#aaffc3' },
  { name: 'Olive Line', color: '#808000' },
  { name: 'Apricot Line', color: '#ffd8b1' },
  { name: 'Navy Line', color: '#000075' },
  { name: 'Grey Line', color: '#a9a9a9' },
  { name: 'Black Line', color: '#191919' },
] as const

export const BASE_COLORS = DEFAULT_LINES.map((d) => d.color)

export const LINE_ICONS: { id: LineIcon; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'circle', label: 'Circle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'plus', label: 'Plus' },
  { id: 'heart', label: 'Heart' },
  { id: 'star', label: 'Star' },
]

/** Relative luminance of a #rrggbb color (0-1) — for readable text on it. */
export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  if (isNaN(n)) return 0
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** First default whose color is unused, else wrap around the palette. */
export function nextDefaultLine(usedColors: string[]): { name: string; color: string } {
  for (const d of DEFAULT_LINES) {
    if (!usedColors.includes(d.color)) return d
  }
  return DEFAULT_LINES[usedColors.length % DEFAULT_LINES.length]
}
