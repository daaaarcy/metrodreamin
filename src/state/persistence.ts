import type { MapIndexEntry, SystemMap } from '../types'

const SYSTEMS_KEY = 'md.systems.v1'
const CURRENT_KEY = 'md.current.v1'
const SETTINGS_KEY = 'md.settings.v1'

export interface Settings {
  basemapId: string
  hideWaypoints: boolean
  vehiclesOn: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  basemapId: 'liberty',
  hideWaypoints: false,
  vehiclesOn: false,
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function emptySystem(title: string): SystemMap {
  const now = Date.now()
  return {
    meta: { id: uid(), title, createdAt: now, updatedAt: now },
    stations: {},
    lines: {},
    interchanges: {},
  }
}

export function loadSystems(): Record<string, SystemMap> {
  try {
    const raw = localStorage.getItem(SYSTEMS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveSystems(systems: Record<string, SystemMap>) {
  try {
    localStorage.setItem(SYSTEMS_KEY, JSON.stringify(systems))
  } catch (e) {
    console.warn('localStorage save failed', e)
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
      return {
        meta: {
          id: typeof obj.meta.id === 'string' ? obj.meta.id : uid(),
          title: obj.meta.title,
          createdAt: obj.meta.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        },
        stations: obj.stations,
        lines: obj.lines,
        interchanges: obj.interchanges ?? {},
      }
    }
  } catch {
    /* fallthrough */
  }
  return null
}
