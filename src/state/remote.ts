import type { SystemMap } from '../types'
import { normalizeSystem } from './persistence'

// Local map store (server/store.mjs). Fixed port — independent of the dev or
// preview port the app itself is served from.
export const STORE_URL = 'http://127.0.0.1:8734'

export function remoteIdFromHash(hash = window.location.hash): string | null {
  return hash.match(/#m=([A-Za-z0-9_-]+)/)?.[1] ?? null
}

export async function fetchRemote(id: string): Promise<SystemMap | null> {
  try {
    const r = await fetch(`${STORE_URL}/map/${id}`)
    if (!r.ok) return null
    const j = await r.json()
    return j?.meta && j.stations && j.lines ? normalizeSystem(j as SystemMap) : null
  } catch {
    return null
  }
}

export async function createRemote(sys: SystemMap): Promise<string | null> {
  try {
    const r = await fetch(`${STORE_URL}/map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sys),
    })
    if (!r.ok) return null
    return ((await r.json()) as { id?: string }).id ?? null
  } catch {
    return null
  }
}

const timers = new Map<string, number>()

/** Debounced push of a synced map to the store server (600ms trailing). */
export function pushRemote(sys: SystemMap) {
  const rid = sys.meta.remoteId
  if (!rid) return
  const t = timers.get(rid)
  if (t !== undefined) window.clearTimeout(t)
  timers.set(
    rid,
    window.setTimeout(() => {
      timers.delete(rid)
      fetch(`${STORE_URL}/map/${rid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sys),
      }).catch(() => {})
    }, 600),
  )
}

/** Immediate push of a synced map — cancels any pending debounced push. */
export async function pushRemoteNow(sys: SystemMap): Promise<boolean> {
  const rid = sys.meta.remoteId
  if (!rid) return true
  const t = timers.get(rid)
  if (t !== undefined) {
    window.clearTimeout(t)
    timers.delete(rid)
  }
  try {
    const r = await fetch(`${STORE_URL}/map/${rid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sys),
    })
    return r.ok
  } catch {
    return false
  }
}
