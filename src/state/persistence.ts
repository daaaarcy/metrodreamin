import type { MapIndexEntry, SystemMap } from '../types'

const SYSTEMS_KEY = 'md.systems.v1'
const CURRENT_KEY = 'md.current.v1'
const SETTINGS_KEY = 'md.settings.v1'

export interface Settings {
  basemapId: string
  hideWaypoints: boolean
  vehiclesOn: boolean
  theme: 'dark' | 'light'
  autoName: boolean
  sidebarOpen: boolean
  /** Map id → group keys (mode ids or LineGroup ids) hidden on the map. */
  hiddenGroups: Record<string, string[]>
}

export const DEFAULT_SETTINGS: Settings = {
  basemapId: 'liberty',
  hideWaypoints: false,
  vehiclesOn: false,
  theme: 'dark',
  autoName: true,
  sidebarOpen: true,
  hiddenGroups: {},
}

/** Current map data version. v2: unnamed points became explicit waypoints. */
export const SYSTEM_VERSION = 2

/** Migrate a loaded/imported/fetched system to the current data model. */
export function normalizeSystem(s: SystemMap): SystemMap {
  if ((s.meta.version ?? 1) < 2) {
    for (const p of Object.values(s.stations)) {
      if (!p.name) p.waypoint = true
    }
  }
  s.meta.version = SYSTEM_VERSION
  s.lineGroups ??= {}
  s.interchanges ??= {}
  return s
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function emptySystem(title: string): SystemMap {
  const now = Date.now()
  return {
    meta: { id: uid(), title, createdAt: now, updatedAt: now, version: SYSTEM_VERSION },
    stations: {},
    lines: {},
    interchanges: {},
    lineGroups: {},
  }
}

export function loadSystems(): Record<string, SystemMap> {
  try {
    const raw = localStorage.getItem(SYSTEMS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, SystemMap> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v === 'object' && (v as SystemMap).meta) {
        out[k] = normalizeSystem(v as SystemMap)
      }
    }
    return out
  } catch {
    return {}
  }
}

export function saveSystems(systems: Record<string, SystemMap>): boolean {
  try {
    localStorage.setItem(SYSTEMS_KEY, JSON.stringify(systems))
    return true
  } catch (e) {
    console.warn('localStorage save failed', e)
    return false
  }
}

export function loadCurrentId(): string | null {
  return localStorage.getItem(CURRENT_KEY)
}

export function saveCurrentId(id: string | null) {
  if (id) localStorage.setItem(CURRENT_KEY, id)
  else localStorage.removeItem(CURRENT_KEY)
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function mapIndex(systems: Record<string, SystemMap>): MapIndexEntry[] {
  return Object.values(systems)
    .map((s) => ({
      id: s.meta.id,
      title: s.meta.title,
      updatedAt: s.meta.updatedAt,
      stationCount: Object.keys(s.stations).length,
      lineCount: Object.keys(s.lines).length,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function exportSystem(sys: SystemMap) {
  const blob = new Blob([JSON.stringify(sys, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sys.meta.title.replace(/[^\w-]+/g, '_') || 'map'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Validate an imported JSON payload; returns null if it doesn't look like a system. */
export function parseImport(text: string): SystemMap | null {
  try {
    const obj = JSON.parse(text)
    if (
      obj &&
      obj.meta &&
      typeof obj.meta.title === 'string' &&
      obj.stations &&
      obj.lines &&
      typeof obj.stations === 'object' &&
      typeof obj.lines === 'object'
    ) {
      return normalizeSystem({
        meta: {
          id: typeof obj.meta.id === 'string' ? obj.meta.id : uid(),
          title: obj.meta.title,
          createdAt: obj.meta.createdAt ?? Date.now(),
          updatedAt: Date.now(),
          // remoteId deliberately dropped — an imported copy gets its own identity
          ...(typeof obj.meta.caption === 'string' ? { caption: obj.meta.caption } : {}),
          ...(typeof obj.meta.version === 'number' ? { version: obj.meta.version } : {}),
          ...(typeof obj.meta.branchedFrom === 'string'
            ? { branchedFrom: obj.meta.branchedFrom }
            : {}),
        },
        stations: obj.stations,
        lines: obj.lines,
        interchanges: obj.interchanges ?? {},
        ...(obj.lineGroups && typeof obj.lineGroups === 'object'
          ? { lineGroups: obj.lineGroups }
          : {}),
      })
    }
  } catch {
    /* fallthrough */
  }
  return null
}
