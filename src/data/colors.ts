import type { LineIcon } from '../types'

/** MetroDreamin'-style base palette, in assignment priority order. */
export const BASE_COLORS = [
  '#e63946', // red
  '#f4a261', // orange
  '#e9c46a', // yellow
  '#2a9d8f', // teal
  '#457b9d', // steel blue
  '#8ecae6', // light blue
  '#6a4c93', // purple
  '#ef476f', // pink
  '#06d6a0', // mint
  '#118ab2', // ocean
  '#84a98c', // sage
  '#7f5539', // brown
  '#d62828', // crimson
  '#ff9f1c', // amber
  '#a7c957', // lime
  '#3a86ff', // blue
  '#8338ec', // violet
  '#ff006e', // magenta
  '#8d99ae', // slate
  '#386641', // forest
  '#22223b', // navy
] as const

export const LINE_ICONS: { id: LineIcon; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'circle', label: 'Circle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'plus', label: 'Plus' },
  { id: 'heart', label: 'Heart' },
  { id: 'star', label: 'Star' },
]

/** Pick the first base color not already used by an existing line. */
export function nextLineColor(used: string[]): string {
  for (const c of BASE_COLORS) {
    if (!used.includes(c)) return c
  }
  return BASE_COLORS[used.length % BASE_COLORS.length]
}
