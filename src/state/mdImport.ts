import type { Grade, Interchange, Line, LineGroup, LineIcon, MapPoint, ModeId, SystemMap } from '../types'
import { SYSTEM_VERSION, uid } from './persistence'

// metrodreamin.com mode keys → ours
const MODES: Record<string, ModeId> = {
  GONDOLA: 'gondola',
  BUS: 'bus',
  TRAM: 'tram',
  FERRY: 'ferry',
  BRT: 'brt',
  LIGHT: 'lrt',
  RAPID: 'metro',
  REGIONAL: 'commuter',
  MLDISTANCE: 'regional',
  HSR: 'hsr',
  AIR: 'airliner',
}

const GRADES = new Set<Grade>(['above', 'at', 'below'])
const ICONS = new Set<LineIcon>(['circle', 'diamond', 'plus', 'heart', 'star'])

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

/** Convert a metrodreamin.com map payload (from __NEXT_DATA__) to a SystemMap. */
export function fromMetroDreamin(map: unknown): SystemMap | null {
  if (!isObj(map) || !isObj(map.stations) || !isObj(map.lines)) return null

  const stations: Record<string, MapPoint> = {}
  for (const [id, s] of Object.entries(map.stations)) {
    if (!isObj(s) || !isNum(s.lng) || !isNum(s.lat)) continue
    const waypoint = s.isWaypoint === true
    const p: MapPoint = { id: isStr(s.id) ? s.id : id, lng: s.lng, lat: s.lat }
    if (waypoint) p.waypoint = true
    else if (isStr(s.name) && s.name) p.name = s.name
    if (GRADES.has(s.grade as Grade)) p.grade = s.grade as Grade
    stations[p.id] = p
  }

  const lineGroups: Record<string, LineGroup> = {}
  if (isObj(map.lineGroups)) {
    for (const [id, g] of Object.entries(map.lineGroups)) {
      if (!isObj(g)) continue
      const gid = isStr(g.id) ? g.id : id
      lineGroups[gid] = { id: gid, label: isStr(g.label) && g.label ? g.label : 'Group Name' }
    }
  }

  const lines: Record<string, Line> = {}
  for (const [id, l] of Object.entries(map.lines)) {
    if (!isObj(l)) continue
    const lid = isStr(l.id) ? l.id : id
    const stationIds = Array.isArray(l.stationIds)
      ? l.stationIds.filter((s): s is string => isStr(s) && s in stations)
      : []
    const line: Line = {
      id: lid,
      name: isStr(l.name) && l.name ? l.name : 'Line',
      color: isStr(l.color) && l.color ? l.color : '#e6194b',
      mode: MODES[l.mode as string] ?? 'metro',
      stationIds,
    }
    const wo = Array.isArray(l.waypointOverrides)
      ? l.waypointOverrides.filter((s): s is string => isStr(s) && s in stations)
      : []
    if (wo.length) line.waypointOverrides = wo
    if (ICONS.has(l.icon as LineIcon)) line.icon = l.icon as LineIcon
    if (isStr(l.lineGroupId) && l.lineGroupId in lineGroups) line.groupId = l.lineGroupId
    lines[lid] = line
  }

  const interchanges: Record<string, Interchange> = {}
  if (isObj(map.interchanges)) {
    for (const [id, ic] of Object.entries(map.interchanges)) {
      if (!isObj(ic)) continue
      const stationIds = Array.isArray(ic.stationIds)
        ? ic.stationIds.filter((s): s is string => isStr(s) && s in stations)
        : []
      if (stationIds.length < 2) continue
      const iid = isStr(ic.id) ? ic.id : id
      interchanges[iid] = { id: iid, stationIds }
    }
  }

  const now = Date.now()
  return {
    meta: {
      id: uid(),
      title: isStr(map.title) && map.title ? map.title : 'MetroDreamin import',
      caption: isStr(map.caption) && map.caption ? map.caption : undefined,
      createdAt: now,
      updatedAt: now,
      version: SYSTEM_VERSION,
    },
    stations,
    lines,
    interchanges,
    lineGroups,
  }
}
