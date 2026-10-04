import { create } from 'zustand'
import { produce } from 'immer'
import type {
  ActivePath,
  Grade,
  Interchange,
  Line,
  LineIcon,
  MapPoint,
  ModeId,
  SystemMap,
} from '../types'
import { DEFAULT_LINES, nextDefaultLine } from '../data/colors'
import {
  emptySystem,
  loadCurrentId,
  loadSettings,
  loadSystems,
  parseImport,
  saveCurrentId,
  saveSettings,
  saveSystems,
  uid,
} from './persistence'
import { createRemote, fetchRemote, pushRemote, pushRemoteNow, STORE_URL } from './remote'
import { fromMetroDreamin } from './mdImport'
import { bestInsertIndex, canMakeLoop, linesThrough } from '../geo/query'
import { haversineKm } from '../geo/curves'
import { reverseName } from '../geo/reverse'
import { fitPoints } from '../map/mapRef'

const HISTORY_CAP = 200
const STORAGE_FULL = 'Browser storage is full — export your map to JSON to keep it'
const COARSE_MODES = new Set<ModeId>(['regional', 'hsr', 'airliner'])

interface Store {
  systems: Record<string, SystemMap>
  currentId: string | null

  past: SystemMap[]
  future: SystemMap[]

  selectedLineId: string | null
  selectedStationId: string | null
  activePath: ActivePath | null
  pendingInterchangeFrom: string | null

  basemapId: string
  hideWaypoints: boolean
  vehiclesOn: boolean
  theme: 'dark' | 'light'
  autoName: boolean
  sidebarOpen: boolean
  /** Group keys (mode ids or LineGroup ids) hidden on the map for the current map. */
  hiddenGroups: string[]
  /** Sticky "adding waypoints" mode — new points are created as waypoints. */
  addingWaypoints: boolean
  /** Line most recently edited — used to rank "Add to line" suggestions. */
  recentLineId: string | null
  saveStatus: { at: number | null; error: string | null; syncing: boolean }
  detailsOpen: boolean
  drawerOpen: boolean
  newMapOpen: boolean

  // --- system mutations (undoable) ---
  addPoint: (lng: number, lat: number) => void
  appendExistingPoint: (stationId: string) => void
  insertPointOnLine: (lineId: string, branchIndex: number | null, index: number, lng: number, lat: number) => void
  movePoint: (id: string, lng: number, lat: number) => void // transient (no history)
  beginDrag: () => void
  endDrag: () => void
  renamePoint: (id: string, name: string) => void
  setGrade: (id: string, grade: Grade | undefined) => void
  deletePoint: (id: string) => void
  /** Toggle a point between waypoint and station; sets the sticky waypoint mode. */
  convertPoint: (id: string, toWaypoint: boolean) => void
  setAddingWaypoints: (v: boolean) => void

  addLine: (fromStationId?: string, opts?: { mode?: ModeId; groupId?: string }) => void
  setLineName: (id: string, name: string) => void
  setLineColor: (id: string, color: string) => void
  setLineMode: (id: string, mode: ModeId) => void
  setLineIcon: (id: string, icon: LineIcon | undefined) => void
  deleteLine: (id: string) => void
  toggleLineWaypoint: (lineId: string, stationId: string) => void
  /** Remove a point from one line's paths without deleting the point itself. */
  removeFromLine: (lineId: string, stationId: string) => void
  /** Remove several points from one line's paths at once (single undo frame). */
  removePointsFromLine: (lineId: string, ids: string[]) => void
  /** Insert an existing point into a line's trunk at the best angle delta. */
  addToLine: (lineId: string, pointId: string) => void
  /** Close a loop on a point already on the line's trunk (MD's loopInLine). */
  makeLoop: (lineId: string, pointId: string) => void
  reverseLine: (lineId: string) => void
  duplicateLine: (lineId: string) => void
  forkLine: (lineId: string, rootStationId: string) => void

  // --- custom line groups ---
  addLineGroup: () => string
  renameLineGroup: (id: string, label: string) => void
  deleteLineGroup: (id: string) => void
  setLineGroup: (lineId: string, groupId: string | null) => void
  toggleGroupHidden: (key: string) => void

  setCaption: (text: string) => void
  /** Flush to localStorage now; synced maps also push to the store server now. */
  save: () => Promise<void>
  /** Duplicate the current map and open the copy. */
  saveCopy: () => void

  createInterchange: (a: string, b: string) => void
  removeInterchange: (id: string) => void
  removeFromInterchange: (interchangeId: string, stationId: string) => void

  renameCurrentMap: (title: string) => void
  undo: () => void
  redo: () => void

  /** Register/copy the current map on the local store server; returns its link. */
  shareCurrentMap: () => Promise<string | null>
  /** Load a shared map by token and pull newer remote copies of synced maps. */
  hydrateRemote: (remoteId?: string | null) => Promise<void>

  // --- selection / ui ---
  selectLine: (id: string | null) => void
  selectStation: (id: string | null) => void
  setActivePath: (p: ActivePath | null) => void
  setPendingInterchange: (stationId: string | null) => void
  setBasemap: (id: string) => void
  setHideWaypoints: (v: boolean) => void
  setVehiclesOn: (v: boolean) => void
  setTheme: (t: 'dark' | 'light') => void
  setSidebarOpen: (v: boolean) => void
  setAutoName: (v: boolean) => void
  setDetailsOpen: (v: boolean) => void
  setDrawerOpen: (v: boolean) => void
  setNewMapOpen: (v: boolean) => void

  // --- map management ---
  newMap: (title: string) => void
  openMap: (id: string) => void
  deleteMap: (id: string) => void
  duplicateMap: (id: string) => string | undefined
  importMap: (text: string) => string | null // error message or null
  /** Import a metrodreamin.com /view or /edit link via the store server. */
  importMetroDreamin: (url: string) => Promise<string | null> // error message or null
}

function initialState() {
  const systems = loadSystems()
  const settings = loadSettings()
  let currentId = loadCurrentId()
  if (!currentId || !systems[currentId]) {
    currentId = Object.keys(systems)[0] ?? null
  }
  return { systems, currentId, settings }
}

const init = initialState()
// per-map hidden line groups (settings.hiddenGroups), loaded once
const hiddenByMap: Record<string, string[]> = { ...init.settings.hiddenGroups }

export const useStore = create<Store>()((set, get) => {
  /** Persist systems and compute the resulting saveStatus. */
  const persist = (systems: Record<string, SystemMap>) => {
    const ok = saveSystems(systems)
    const prev = get().saveStatus
    return ok
      ? { at: Date.now(), error: null, syncing: prev.syncing }
      : { at: prev.at, error: STORAGE_FULL, syncing: false }
  }

  const persistSettings = () => {
    const s = get()
    saveSettings({
      basemapId: s.basemapId,
      hideWaypoints: s.hideWaypoints,
      vehiclesOn: s.vehiclesOn,
      theme: s.theme,
      autoName: s.autoName,
      sidebarOpen: s.sidebarOpen,
      hiddenGroups: hiddenByMap,
    })
  }

  /** Mutate the current system with undo history + persist. */
  const mutate = (fn: (sys: SystemMap) => void) => {
    set((state) => {
      const id = state.currentId
      if (!id) return {}
      const before = state.systems[id]
      if (!before) return {}
      const next = produce(before, (s) => {
        fn(s)
        s.meta.updatedAt = Date.now()
      })
      if (next === before) return {}
      const systems = { ...state.systems, [id]: next }
      return {
        systems,
        saveStatus: persist(systems),
        past: [...state.past, before].slice(-HISTORY_CAP),
        future: [],
      }
    })
  }

  /** Mutate without touching history (e.g. mid-drag). */
  const transient = (fn: (sys: SystemMap) => void) => {
    set((state) => {
      const id = state.currentId
      if (!id) return {}
      const before = state.systems[id]
      if (!before) return {}
      const next = produce(before, (s) => {
        fn(s)
        s.meta.updatedAt = Date.now()
      })
      if (next === before) return {}
      const systems = { ...state.systems, [id]: next }
      return { systems, saveStatus: persist(systems) }
    })
  }

  let dragSnapshot: SystemMap | null = null

  const sys = () => {
    const { systems, currentId } = get()
    return currentId ? systems[currentId] : undefined
  }

  /** Auto-name a station from its surroundings (street or town level by mode). */
  const maybeAutoName = (pointId: string, mode?: ModeId) => {
    if (!get().autoName) return
    const p = sys()?.stations[pointId]
    if (!p || p.waypoint || p.name) return
    void reverseName(p.lng, p.lat, !!mode && COARSE_MODES.has(mode)).then((name) => {
      if (!name) return
      transient((d) => {
        const pt = d.stations[pointId]
        if (pt && !pt.waypoint && !pt.name) pt.name = name
      })
    })
  }

  /** Adopt a parsed/converted system as a new map and open it. */
  const adoptSystem = (s: SystemMap) => {
    if (get().systems[s.meta.id]) s.meta.id = uid()
    set((state) => {
      const systems = { ...state.systems, [s.meta.id]: s }
      return {
        systems,
        saveStatus: persist(systems),
        currentId: s.meta.id,
        past: [],
        future: [],
        selectedLineId: null,
        selectedStationId: null,
        activePath: null,
        newMapOpen: false,
        drawerOpen: false,
        hiddenGroups: hiddenByMap[s.meta.id] ?? [],
      }
    })
    saveCurrentId(s.meta.id)
  }

  /** Station ids an ActivePath refers to. */
  const pathIds = (line: Line, ap: ActivePath): string[] =>
    ap.branchIndex == null ? line.stationIds : (line.branches?.[ap.branchIndex]?.stationIds ?? [])

  const addPointToPath = (sys: SystemMap, ap: ActivePath, point: MapPoint) => {
    sys.stations[point.id] = point
    const line = sys.lines[ap.lineId]
    if (!line) return
    const ids = pathIds(line, ap)
    if (ap.end === 'end') ids.push(point.id)
    else ids.unshift(point.id)
  }

  return {
    systems: init.systems,
    currentId: init.currentId,
    past: [],
    future: [],
    selectedLineId: null,
    selectedStationId: null,
    activePath: null,
    pendingInterchangeFrom: null,
    basemapId: init.settings.basemapId,
    hideWaypoints: init.settings.hideWaypoints,
    vehiclesOn: init.settings.vehiclesOn,
    theme: init.settings.theme,
    autoName: init.settings.autoName,
    sidebarOpen: init.settings.sidebarOpen,
    hiddenGroups: init.currentId ? (hiddenByMap[init.currentId] ?? []) : [],
    addingWaypoints: false,
    recentLineId: null,
    saveStatus: { at: null, error: null, syncing: false },
    detailsOpen: false,
    drawerOpen: false,
    newMapOpen: !init.currentId,

    // ---------------- editing ----------------

    addPoint: (lng, lat) => {
      const s = sys()
      if (!s) return
      const point: MapPoint = { id: uid(), lng, lat }
      if (get().addingWaypoints) point.waypoint = true
      const { activePath, selectedLineId } = get()

      let ap = activePath
      if (!ap || !s.lines[ap.lineId]) {
        // default: extend end of selected line, else create a new line
        ap =
          selectedLineId && s.lines[selectedLineId]
            ? { lineId: selectedLineId, branchIndex: null, end: 'end' }
            : null
      }

      if (!ap) {
        mutate((d) => {
          d.stations[point.id] = point
          const id = uid()
          const def = nextDefaultLine(Object.values(d.lines).map((l) => l.color))
          d.lines[id] = {
            id,
            name: def.name,
            color: def.color,
            mode: 'metro',
            stationIds: [point.id],
          }
        })
        const s2 = sys()
        const newLineId = s2 ? Object.keys(s2.lines).find((k) => s2.lines[k].stationIds.includes(point.id)) : null
        set({
          selectedLineId: newLineId,
          selectedStationId: point.id,
          recentLineId: newLineId,
          activePath: newLineId ? { lineId: newLineId, branchIndex: null, end: 'end' } : null,
        })
        maybeAutoName(point.id, 'metro')
        return
      }

      mutate((d) => addPointToPath(d, ap!, point))
      // placing a point arms drawing so subsequent clicks (incl. existing
      // stations) keep extending the same path
      set({ selectedStationId: point.id, activePath: ap, recentLineId: ap.lineId })
      maybeAutoName(point.id, s.lines[ap.lineId]?.mode)
    },

    /** Attach an existing station/waypoint to the active path's drawing end. */
    appendExistingPoint: (stationId) => {
      const s = sys()
      if (!s || !s.stations[stationId]) return
      const { activePath } = get()
      const ap = activePath && s.lines[activePath.lineId] ? activePath : null
      if (!ap) return
      mutate((d) => {
        const line = d.lines[ap!.lineId]
        if (!line) return
        const ids = pathIds(line, ap!)
        if (ap!.end === 'end') ids.push(stationId)
        else ids.unshift(stationId)
      })
      set({ selectedStationId: stationId, recentLineId: ap.lineId })
    },

    insertPointOnLine: (lineId, branchIndex, index, lng, lat) => {
      const point: MapPoint = { id: uid(), lng, lat, waypoint: true }
      mutate((d) => {
        const line = d.lines[lineId]
        if (!line) return
        d.stations[point.id] = point
        if (branchIndex == null) {
          line.stationIds.splice(index, 0, point.id)
        } else {
          line.branches?.[branchIndex]?.stationIds.splice(index, 0, point.id)
        }
      })
      set({ selectedStationId: point.id })
    },

    beginDrag: () => {
      dragSnapshot = sys() ?? null
    },

    movePoint: (id, lng, lat) => {
      transient((d) => {
        const p = d.stations[id]
        if (p) {
          p.lng = lng
          p.lat = lat
        }
      })
    },

    endDrag: () => {
      if (!dragSnapshot) return
      const snapshot = dragSnapshot
      dragSnapshot = null
      set((state) => {
        const id = state.currentId
        if (!id) return {}
        const cur = state.systems[id]
        if (!cur || cur === snapshot) return {}
        const systems = { ...state.systems, [id]: { ...cur, meta: { ...cur.meta, updatedAt: Date.now() } } }
        return {
          systems,
          saveStatus: persist(systems),
          past: [...state.past, snapshot].slice(-HISTORY_CAP),
          future: [],
        }
      })
    },

    renamePoint: (id, name) => {
      // transient: callers wrap typing sessions in beginDrag/endDrag so history
      // gets a single commit on blur instead of one frame per keystroke
      transient((d) => {
        const p = d.stations[id]
        if (!p) return
        if (name.trim()) p.name = name.trim()
        else delete p.name
      })
    },

    setGrade: (id, grade) => {
      mutate((d) => {
        const p = d.stations[id]
        if (!p) return
        if (grade) p.grade = grade
        else delete p.grade
      })
    },

    deletePoint: (id) => {
      mutate((d) => {
        delete d.stations[id]
        for (const line of Object.values(d.lines)) {
          line.stationIds = line.stationIds.filter((s) => s !== id)
          line.waypointOverrides = line.waypointOverrides?.filter((s) => s !== id)
          line.branches = line.branches
            ?.map((b) => ({ ...b, stationIds: b.stationIds.filter((s) => s !== id) }))
            .filter((b) => b.stationIds.length > 0 && d.stations[b.rootStationId])
        }
        for (const [lid, line] of Object.entries(d.lines)) {
          const total = line.stationIds.length + (line.branches ?? []).flatMap((b) => b.stationIds).length
          if (total < 2) delete d.lines[lid]
        }
        for (const [iid, ic] of Object.entries(d.interchanges)) {
          ic.stationIds = ic.stationIds.filter((s) => s !== id)
          if (ic.stationIds.length < 2) delete d.interchanges[iid]
        }
      })
      const { selectedStationId, selectedLineId } = get()
      const s = sys()
      if (selectedStationId === id) set({ selectedStationId: null })
      if (s && selectedLineId && !s.lines[selectedLineId]) {
        set({ selectedLineId: null, activePath: null })
      }
    },

    convertPoint: (id, toWaypoint) => {
      const s = sys()
      if (!s?.stations[id]) return
      mutate((d) => {
        const p = d.stations[id]
        if (!p) return
        if (toWaypoint) {
          p.waypoint = true
          // name is kept — converting back restores it; displays ignore it
          for (const [iid, ic] of Object.entries(d.interchanges)) {
            ic.stationIds = ic.stationIds.filter((sid) => sid !== id)
            if (ic.stationIds.length < 2) delete d.interchanges[iid]
          }
        } else {
          delete p.waypoint
        }
      })
      // converting sets the sticky mode — subsequent clicks add the same kind
      set({ addingWaypoints: toWaypoint })
      if (!toWaypoint) {
        maybeAutoName(id, linesThrough(s, id)[0]?.mode)
      }
    },

    setAddingWaypoints: (v) => set({ addingWaypoints: v }),

    addLine: (fromStationId, opts) => {
      const s = sys()
      if (!s) return
      const id = uid()
      const seed = fromStationId && s.stations[fromStationId] ? [fromStationId] : []
      mutate((d) => {
        const def = nextDefaultLine(Object.values(d.lines).map((l) => l.color))
        d.lines[id] = {
          id,
          name: def.name,
          color: def.color,
          mode: opts?.mode ?? 'metro',
          stationIds: seed,
          ...(opts?.groupId && d.lineGroups?.[opts.groupId] ? { groupId: opts.groupId } : {}),
        }
      })
      set({
        selectedLineId: id,
        selectedStationId: null,
        recentLineId: id,
        activePath: { lineId: id, branchIndex: null, end: 'end' },
      })
    },

    setLineName: (id, name) => {
      transient((d) => {
        const l = d.lines[id]
        if (l) l.name = name
      })
    },

    setLineColor: (id, color) => {
      transient((d) => {
        const l = d.lines[id]
        if (!l) return
        l.color = color
        // rename while the line still carries a default name (MD behavior)
        const def = DEFAULT_LINES.find((dl) => dl.color === color)
        if (def && DEFAULT_LINES.some((dl) => dl.name === l.name)) l.name = def.name
      })
    },

    setLineMode: (id, mode) => {
      mutate((d) => {
        const l = d.lines[id]
        if (l) l.mode = mode
      })
    },

    setLineIcon: (id, icon) => {
      mutate((d) => {
        const l = d.lines[id]
        if (!l) return
        if (icon && icon !== 'solid') l.icon = icon
        else delete l.icon
      })
    },

    deleteLine: (id) => {
      mutate((d) => {
        delete d.lines[id]
      })
      const { selectedLineId } = get()
      if (selectedLineId === id) set({ selectedLineId: null, activePath: null })
    },

    toggleLineWaypoint: (lineId, stationId) => {
      mutate((d) => {
        const l = d.lines[lineId]
        if (!l) return
        const set0 = new Set(l.waypointOverrides ?? [])
        if (set0.has(stationId)) set0.delete(stationId)
        else set0.add(stationId)
        l.waypointOverrides = [...set0]
        if (!l.waypointOverrides.length) delete l.waypointOverrides
      })
    },

    removeFromLine: (lineId, stationId) => get().removePointsFromLine(lineId, [stationId]),

    removePointsFromLine: (lineId, ids) => {
      const drop = new Set(ids)
      mutate((d) => {
        const l = d.lines[lineId]
        if (!l) return
        l.stationIds = l.stationIds.filter((id) => !drop.has(id))
        l.waypointOverrides = l.waypointOverrides?.filter((id) => !drop.has(id))
        l.branches = l.branches
          ?.map((b) => ({ ...b, stationIds: b.stationIds.filter((id) => !drop.has(id)) }))
          .filter((b) => b.stationIds.length > 0)
        const total =
          l.stationIds.length +
          (l.branches ?? []).reduce((n, b) => n + b.stationIds.length, 0)
        if (total < 2) delete d.lines[lineId]
      })
      const s = sys()
      if (s && get().selectedLineId === lineId && !s.lines[lineId]) {
        set({ selectedLineId: null, activePath: null })
      }
    },

    addToLine: (lineId, pointId) => {
      const s = sys()
      const line = s?.lines[lineId]
      const p = s?.stations[pointId]
      if (!s || !line || !p) return
      const index = bestInsertIndex(s, line, p)
      mutate((d) => {
        const l = d.lines[lineId]
        if (!l || l.stationIds.includes(pointId)) return
        l.stationIds.splice(index, 0, pointId)
      })
      set({ recentLineId: lineId, selectedStationId: pointId })
    },

    makeLoop: (lineId, pointId) => {
      const s = sys()
      const line = s?.lines[lineId]
      const p = s?.stations[pointId]
      if (!s || !line || !p || !canMakeLoop(line, pointId)) return
      const ids = line.stationIds
      const pos = ids.indexOf(pointId)
      let atStart: boolean
      if (pos === 0) atStart = false
      else if (pos === ids.length - 1) atStart = true
      else {
        // mid-line point: close on whichever trunk end is nearer
        const first = s.stations[ids[0]]
        const last = s.stations[ids[ids.length - 1]]
        const dStart = first ? haversineKm([p.lng, p.lat], [first.lng, first.lat]) : Infinity
        const dEnd = last ? haversineKm([p.lng, p.lat], [last.lng, last.lat]) : Infinity
        atStart = dStart < dEnd
      }
      mutate((d) => {
        const l = d.lines[lineId]
        if (!l) return
        if (atStart) l.stationIds.unshift(pointId)
        else l.stationIds.push(pointId)
      })
      set({ recentLineId: lineId })
    },

    reverseLine: (lineId) => {
      mutate((d) => {
        const l = d.lines[lineId]
        if (l) l.stationIds.reverse()
      })
      const ap = get().activePath
      if (ap && ap.lineId === lineId && ap.branchIndex == null) {
        set({ activePath: { ...ap, end: ap.end === 'end' ? 'start' : 'end' } })
      }
    },

    duplicateLine: (lineId) => {
      const src = sys()?.lines[lineId]
      if (!src) return
      const copy: Line = JSON.parse(JSON.stringify(src))
      copy.id = uid()
      copy.name = `${src.name} - Fork`
      mutate((d) => {
        d.lines[copy.id] = copy
      })
      get().selectLine(copy.id)
      set({ recentLineId: copy.id })
    },

    forkLine: (lineId, rootStationId) => {
      mutate((d) => {
        const l = d.lines[lineId]
        if (!l) return
        // drop any abandoned empty branches first
        l.branches = (l.branches ?? []).filter((b) => b.stationIds.length > 0)
        l.branches.push({ rootStationId, stationIds: [] })
      })
      const l = sys()?.lines[lineId]
      const idx = (l?.branches?.length ?? 1) - 1
      if (idx >= 0) {
        set({
          selectedLineId: lineId,
          recentLineId: lineId,
          activePath: { lineId, branchIndex: idx, end: 'end' },
        })
      }
    },

    addLineGroup: () => {
      const id = uid()
      mutate((d) => {
        d.lineGroups ??= {}
        d.lineGroups[id] = { id, label: 'Group Name' }
      })
      return id
    },

    renameLineGroup: (id, label) => {
      // transient: callers wrap typing in beginDrag/endDrag for one undo frame
      transient((d) => {
        const g = d.lineGroups?.[id]
        if (g) g.label = label
      })
    },

    deleteLineGroup: (id) => {
      mutate((d) => {
        delete d.lineGroups?.[id]
        for (const l of Object.values(d.lines)) {
          if (l.groupId === id) delete l.groupId
        }
      })
    },

    setLineGroup: (lineId, groupId) => {
      mutate((d) => {
        const l = d.lines[lineId]
        if (!l) return
        if (groupId && d.lineGroups?.[groupId]) l.groupId = groupId
        else if (!groupId) delete l.groupId
      })
    },

    toggleGroupHidden: (key) => {
      const { currentId, hiddenGroups } = get()
      const next = hiddenGroups.includes(key)
        ? hiddenGroups.filter((k) => k !== key)
        : [...hiddenGroups, key]
      set({ hiddenGroups: next })
      if (currentId) {
        hiddenByMap[currentId] = next
        persistSettings()
      }
    },

    setCaption: (text) => {
      transient((d) => {
        if (text.trim()) d.meta.caption = text
        else delete d.meta.caption
      })
    },

    save: async () => {
      const s = sys()
      if (!s) return
      if (!saveSystems(get().systems)) {
        set({ saveStatus: { at: get().saveStatus.at, error: STORAGE_FULL, syncing: false } })
        return
      }
      if (!s.meta.remoteId) {
        set({ saveStatus: { at: Date.now(), error: null, syncing: false } })
        return
      }
      set({ saveStatus: { at: Date.now(), error: null, syncing: true } })
      const pushed = await pushRemoteNow(s)
      set({
        saveStatus: {
          at: Date.now(),
          error: pushed ? null : 'Saved in this browser — store server unreachable',
          syncing: false,
        },
      })
    },

    saveCopy: () => {
      const { currentId, duplicateMap, openMap } = get()
      if (!currentId) return
      const id = duplicateMap(currentId)
      if (id) openMap(id)
    },

    createInterchange: (a, b) => {
      if (a === b) return
      mutate((d) => {
        // merge into an existing group if either station is already in one
        const existing = Object.values(d.interchanges).find(
          (ic) => ic.stationIds.includes(a) || ic.stationIds.includes(b),
        )
        if (existing) {
          for (const s of [a, b]) if (!existing.stationIds.includes(s)) existing.stationIds.push(s)
          return
        }
        const ic: Interchange = { id: uid(), stationIds: [a, b] }
        d.interchanges[ic.id] = ic
      })
      set({ pendingInterchangeFrom: null })
    },

    removeInterchange: (id) => {
      mutate((d) => {
        delete d.interchanges[id]
      })
    },

    removeFromInterchange: (interchangeId, stationId) => {
      mutate((d) => {
        const ic = d.interchanges[interchangeId]
        if (!ic) return
        ic.stationIds = ic.stationIds.filter((s) => s !== stationId)
        if (ic.stationIds.length < 2) delete d.interchanges[interchangeId]
      })
    },

    renameCurrentMap: (title) => {
      // transient — TopBar wraps typing in beginDrag/endDrag for one undo frame
      transient((d) => {
        d.meta.title = title
      })
    },

    undo: () => {
      set((state) => {
        const id = state.currentId
        if (!id || state.past.length === 0) return {}
        const prev = state.past[state.past.length - 1]
        const systems = { ...state.systems, [id]: prev }
        return {
          systems,
          saveStatus: persist(systems),
          past: state.past.slice(0, -1),
          future: [...state.future, state.systems[id]],
        }
      })
    },

    redo: () => {
      set((state) => {
        const id = state.currentId
        if (!id || state.future.length === 0) return {}
        const next = state.future[state.future.length - 1]
        const systems = { ...state.systems, [id]: next }
        return {
          systems,
          saveStatus: persist(systems),
          future: state.future.slice(0, -1),
          past: [...state.past, state.systems[id]].slice(-HISTORY_CAP),
        }
      })
    },

    // ---------------- selection / ui ----------------

    // Selecting a line is only an editing context — it does NOT arm drawing.
    // Drawing is armed by: new line, terminus click, branch, or adding a point.
    selectLine: (id) =>
      set((s) => ({
        selectedLineId: id,
        selectedStationId: null,
        activePath: null,
        recentLineId: id ?? s.recentLineId,
      })),

    selectStation: (id) => set({ selectedStationId: id }),

    setActivePath: (p) => set({ activePath: p }),

    setPendingInterchange: (stationId) => set({ pendingInterchangeFrom: stationId }),

    setBasemap: (id) => {
      set({ basemapId: id })
      persistSettings()
    },
    setHideWaypoints: (v) => {
      set({ hideWaypoints: v })
      persistSettings()
    },
    setVehiclesOn: (v) => {
      set({ vehiclesOn: v })
      persistSettings()
    },
    setTheme: (t) => {
      set({ theme: t })
      persistSettings()
    },
    setSidebarOpen: (v) => {
      set({ sidebarOpen: v })
      persistSettings()
    },
    setAutoName: (v) => {
      set({ autoName: v })
      persistSettings()
    },
    setDetailsOpen: (v) => set({ detailsOpen: v }),
    setDrawerOpen: (v) => set({ drawerOpen: v }),
    setNewMapOpen: (v) => set({ newMapOpen: v }),

    // ---------------- map management ----------------

    newMap: (title) => {
      const s = emptySystem(title || 'Untitled system')
      set((state) => {
        const systems = { ...state.systems, [s.meta.id]: s }
        return {
          systems,
          saveStatus: persist(systems),
          currentId: s.meta.id,
          past: [],
          future: [],
          selectedLineId: null,
          selectedStationId: null,
          activePath: null,
          newMapOpen: false,
          hiddenGroups: [],
        }
      })
      saveCurrentId(s.meta.id)
    },

    openMap: (id) => {
      if (!get().systems[id]) return
      set({
        currentId: id,
        past: [],
        future: [],
        selectedLineId: null,
        selectedStationId: null,
        activePath: null,
        drawerOpen: false,
        hiddenGroups: hiddenByMap[id] ?? [],
      })
      saveCurrentId(id)
    },

    deleteMap: (id) => {
      set((state) => {
        const systems = { ...state.systems }
        delete systems[id]
        const stillCurrent = state.currentId === id
        const currentId = stillCurrent ? (Object.keys(systems)[0] ?? null) : state.currentId
        saveCurrentId(currentId)
        return {
          systems,
          saveStatus: persist(systems),
          currentId,
          past: stillCurrent ? [] : state.past,
          future: stillCurrent ? [] : state.future,
          newMapOpen: stillCurrent && !currentId,
          ...(currentId !== state.currentId
            ? { hiddenGroups: currentId ? (hiddenByMap[currentId] ?? []) : [] }
            : {}),
        }
      })
      delete hiddenByMap[id]
      persistSettings()
    },

    duplicateMap: (id) => {
      const src = get().systems[id]
      if (!src) return undefined
      const copy: SystemMap = JSON.parse(JSON.stringify(src))
      copy.meta = { ...copy.meta, id: uid(), title: `${src.meta.title} (copy)`, updatedAt: Date.now() }
      delete copy.meta.remoteId // a duplicate gets its own identity — no shared token
      set((state) => {
        const systems = { ...state.systems, [copy.meta.id]: copy }
        return { systems, saveStatus: persist(systems) }
      })
      return copy.meta.id
    },

    importMap: (text) => {
      const parsed = parseImport(text)
      if (!parsed) return 'File is not a valid metro system JSON.'
      adoptSystem(parsed)
      return null
    },

    importMetroDreamin: async (url) => {
      let map: unknown
      try {
        const r = await fetch(`${STORE_URL}/import?url=${encodeURIComponent(url)}`)
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          return j.error ?? 'Could not read that MetroDreamin map.'
        }
        map = ((await r.json()) as { map?: unknown }).map
      } catch {
        return 'Store server is not running — start it with: npm run store'
      }
      const converted = map ? fromMetroDreamin(map) : null
      if (!converted) return 'Could not read that MetroDreamin map.'
      adoptSystem(converted)
      setTimeout(() => fitPoints(Object.values(converted.stations)), 350)
      return null
    },

    shareCurrentMap: async () => {
      const cur = sys()
      if (!cur) return null
      let rid = cur.meta.remoteId
      if (!rid) {
        const created = await createRemote(cur)
        if (!created) return null
        rid = created
        const remoteId = created
        set((state) => {
          const id = state.currentId
          const s = id ? state.systems[id] : undefined
          if (!s) return {}
          const systems = {
            ...state.systems,
            [s.meta.id]: { ...s, meta: { ...s.meta, remoteId } },
          }
          return { systems, saveStatus: persist(systems) }
        })
      }
      const updated = sys()
      if (updated) pushRemote(updated)
      if (window.location.hash !== `#m=${rid}`) window.location.hash = `m=${rid}`
      return `${window.location.origin}/#m=${rid}`
    },

    hydrateRemote: async (remoteId) => {
      if (remoteId) {
        const remote = await fetchRemote(remoteId)
        if (remote) {
          remote.meta.remoteId = remoteId
          set((state) => {
            const systems = { ...state.systems, [remote.meta.id]: remote }
            saveCurrentId(remote.meta.id)
            return {
              systems,
              saveStatus: persist(systems),
              currentId: remote.meta.id,
              selectedLineId: null,
              selectedStationId: null,
              activePath: null,
              past: [],
              future: [],
              newMapOpen: false,
              hiddenGroups: hiddenByMap[remote.meta.id] ?? [],
            }
          })
        }
      }
      // refresh locally-synced maps whose remote copy is newer (other ports)
      const locals = Object.values(get().systems).filter((s) => s.meta.remoteId)
      if (!locals.length) return
      const systems = { ...get().systems }
      let changed = false
      for (const local of locals) {
        const remote = await fetchRemote(local.meta.remoteId!)
        if (remote && remote.meta.updatedAt > local.meta.updatedAt) {
          remote.meta.remoteId = local.meta.remoteId
          systems[remote.meta.id] = remote
          if (remote.meta.id !== local.meta.id) delete systems[local.meta.id]
          changed = true
        }
      }
      if (changed) {
        set({ systems, saveStatus: persist(systems) })
      }
    },
  }
})

// Push synced maps to the local store server whenever they change (debounced).
const seenForSync = new Map<string, SystemMap>()
useStore.subscribe((s) => {
  for (const sys of Object.values(s.systems)) {
    if (!sys.meta.remoteId || seenForSync.get(sys.meta.id) === sys) continue
    seenForSync.set(sys.meta.id, sys)
    pushRemote(sys)
  }
})

/** Convenience selector for the open system. */
export function useSystem(): SystemMap | undefined {
  return useStore((s) => (s.currentId ? s.systems[s.currentId] : undefined))
}

// debug/test handle
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__mdStore = useStore
}
