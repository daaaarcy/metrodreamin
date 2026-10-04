import type { Line, ModeId, SystemMap } from '../types'
import { MODES } from './modes'

/** MetroDreamin's line ordering: numeric prefixes/suffixes sort numerically. */
export function sortLines(a: Line, b: Line): number {
  const aName = a.name.toUpperCase()
  const bName = b.name.toUpperCase()
  const pA = aName.split(' ')
  const pB = bName.split(' ')
  const fA = parseInt(pA[0])
  const fB = parseInt(pB[0])
  const lA = parseInt(pA[pA.length - 1])
  const lB = parseInt(pB[pB.length - 1])
  if (!isNaN(fA) && !isNaN(fB)) return fA === fB ? (aName > bName ? 1 : -1) : fA - fB
  else if (!isNaN(lA) && !isNaN(lB)) return lA === lB ? (aName > bName ? 1 : -1) : lA - lB
  return aName > bName ? 1 : -1
}

/** Group a line renders under: its custom group when it still exists, else its mode. */
export function groupKey(sys: SystemMap, line: Line): string {
  return line.groupId && sys.lineGroups?.[line.groupId] ? line.groupId : line.mode
}

export interface LineGroupView {
  /** Mode id for mode groups, LineGroup id for custom groups. */
  key: string
  label: string
  custom: boolean
  mode?: ModeId
  lines: Line[]
}

/**
 * Groups for the lines panel: mode groups (that have lines) in MODES order,
 * then every custom group (even empty) sorted by label.
 */
export function lineGroupsView(sys: SystemMap): LineGroupView[] {
  const byKey = new Map<string, Line[]>()
  for (const l of Object.values(sys.lines)) {
    const k = groupKey(sys, l)
    const arr = byKey.get(k)
    if (arr) arr.push(l)
    else byKey.set(k, [l])
  }

  const groups: LineGroupView[] = []
  for (const m of MODES) {
    const lines = byKey.get(m.id)
    if (lines?.length) {
      groups.push({ key: m.id, label: m.label, custom: false, mode: m.id, lines: lines.sort(sortLines) })
    }
  }
  const customs = Object.values(sys.lineGroups ?? {}).sort((a, b) =>
    a.label.toLowerCase().localeCompare(b.label.toLowerCase()),
  )
  for (const g of customs) {
    groups.push({
      key: g.id,
      label: g.label,
      custom: true,
      lines: (byKey.get(g.id) ?? []).sort(sortLines),
    })
  }
  if (!groups.length) {
    const m = MODES.find((m) => m.id === 'metro')!
    return [{ key: m.id, label: m.label, custom: false, mode: m.id, lines: [] }]
  }
  return groups
}
