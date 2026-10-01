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
import { nextLineColor } from '../data/colors'
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
import { createRemote, fetchRemote, pushRemote } from './remote'

const HISTORY_CAP = 200

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
  scoreOpen: boolean
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

  addLine: (fromStationId?: string) => void
  setLineName: (id: string, name: string) => void
  setLineColor: (id: string, color: string) => void
  setLineMode: (id: string, mode: ModeId) => void
  setLineIcon: (id: string, icon: LineIcon | undefined) => void
  deleteLine: (id: string) => void
  toggleLineWaypoint: (lineId: string, stationId: string) => void
  /** Remove a point from one line's paths without deleting the point itself. */
  removeFromLine: (lineId: string, stationId: string) => void
  forkLine: (lineId: string, rootStationId: string) => void

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
  setScoreOpen: (v: boolean) => void
  setDrawerOpen: (v: boolean) => void
  setNewMapOpen: (v: boolean) => void

  // --- map management ---
  newMap: (title: string) => void
  openMap: (id: string) => void
  deleteMap: (id: string) => void
  duplicateMap: (id: string) => void
  importMap: (text: string) => string | null // error message or null
}

function initialState() {
  const systems = loadSystems()
  const settings = loadSettings()
  let currentId = loadCurrentId()
  if (!currentId || !systems[currentId]) {
    currentId = Object.keys(systems)[0] ?? null
  }
  return { systems, currentId, ...settings }
}

const init = initialState()

export const useStore = create<Store>()((set, get) => {
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
      saveSystems(systems)
      return {
        systems,
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
      saveSystems(systems)
      return { systems }
    })
  }

  let dragSnapshot: SystemMap | null = null

  const sys = () => {
    const { systems, currentId } = get()
    return currentId ? systems[currentId] : undefined
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
    basemapId: init.basemapId,
    hideWaypoints: init.hideWaypoints,
    vehiclesOn: init.vehiclesOn,
    scoreOpen: false,
    drawerOpen: false,
    newMapOpen: !init.currentId,

    // ---------------- editing ----------------

    addPoint: (lng, lat) => {
      const s = sys()
      if (!s) return
      const point: MapPoint = { id: uid(), lng, lat }
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
          d.lines[id] = {
            id,
            name: `Line ${Object.keys(d.lines).length + 1}`,
            color: nextLineColor(Object.values(d.lines).map((l) => l.color)),
            mode: 'metro',
            stationIds: [point.id],
          }
        })
        const s2 = sys()
        const newLineId = s2 ? Object.keys(s2.lines).find((k) => s2.lines[k].stationIds.includes(point.id)) : null
        set({
          selectedLineId: newLineId,
          selectedStationId: point.id,
          activePath: newLineId ? { lineId: newLineId, branchIndex: null, end: 'end' } : null,
        })
        return
      }

      mutate((d) => addPointToPath(d, ap!, point))
      // placing a point arms drawing so subsequent clicks (incl. existing
      // stations) keep extending the same path
      set({ selectedStationId: point.id, activePath: ap })
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
      set({ selectedStationId: stationId })
    },

    insertPointOnLine: (lineId, branchIndex, index, lng, lat) => {
      const point: MapPoint = { id: uid(), lng, lat }
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
        saveSystems(systems)
        return { systems, past: [...state.past, snapshot].slice(-HISTORY_CAP), future: [] }
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

    addLine: (fromStationId) => {
      const s = sys()
      if (!s) return
      const id = uid()
      const seed = fromStationId && s.stations[fromStationId] ? [fromStationId] : []
      mutate((d) => {
        d.lines[id] = {
          id,
          name: `Line ${Object.keys(d.lines).length + 1}`,
          color: nextLineColor(Object.values(d.lines).map((l) => l.color)),
          mode: 'metro',
          stationIds: seed,
        }
      })
      set({
        selectedLineId: id,
        selectedStationId: null,
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
        if (l) l.color = color
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

    removeFromLine: (lineId, stationId) => {
      mutate((d) => {
        const l = d.lines[lineId]
        if (!l) return
        l.stationIds = l.stationIds.filter((id) => id !== stationId)
        l.waypointOverrides = l.waypointOverrides?.filter((id) => id !== stationId)
        l.branches = l.branches
          ?.map((b) => ({ ...b, stationIds: b.stationIds.filter((id) => id !== stationId) }))
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
          activePath: { lineId, branchIndex: idx, end: 'end' },
        })
      }
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
        saveSystems(systems)
        return {
          systems,
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
        saveSystems(systems)
        return {
          systems,
          future: state.future.slice(0, -1),
          past: [...state.past, state.systems[id]].slice(-HISTORY_CAP),
        }
      })
    },

    // ---------------- selection / ui ----------------

    // Selecting a line is only an editing context — it does NOT arm drawing.
    // Drawing is armed by: new line, terminus click, branch, or adding a point.
    selectLine: (id) =>
      set({ selectedLineId: id, selectedStationId: null, activePath: null }),

    selectStation: (id) => set({ selectedStationId: id }),

    setActivePath: (p) => set({ activePath: p }),

    setPendingInterchange: (stationId) => set({ pendingInterchangeFrom: stationId }),

    setBasemap: (id) => {
      set({ basemapId: id })
      const { hideWaypoints, vehiclesOn } = get()
      saveSettings({ basemapId: id, hideWaypoints, vehiclesOn })
    },
    setHideWaypoints: (v) => {
      set({ hideWaypoints: v })
      const { basemapId, vehiclesOn } = get()
      saveSettings({ basemapId, hideWaypoints: v, vehiclesOn })
    },
    setVehiclesOn: (v) => {
      set({ vehiclesOn: v })
      const { basemapId, hideWaypoints } = get()
      saveSettings({ basemapId, hideWaypoints, vehiclesOn: v })
    },
    setScoreOpen: (v) => set({ scoreOpen: v }),
    setDrawerOpen: (v) => set({ drawerOpen: v }),
    setNewMapOpen: (v) => set({ newMapOpen: v }),

    // ---------------- map management ----------------

    newMap: (title) => {
      const s = emptySystem(title || 'Untitled system')
      set((state) => {
        const systems = { ...state.systems, [s.meta.id]: s }
        saveSystems(systems)
        return {
          systems,
          currentId: s.meta.id,
          past: [],
          future: [],
          selectedLineId: null,
          selectedStationId: null,
          activePath: null,
          newMapOpen: false,
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
      })
      saveCurrentId(id)
    },

    deleteMap: (id) => {
      set((state) => {
        const systems = { ...state.systems }
        delete systems[id]
        saveSystems(systems)
        const stillCurrent = state.currentId === id
        const currentId = stillCurrent ? (Object.keys(systems)[0] ?? null) : state.currentId
        saveCurrentId(currentId)
        return {
          systems,
          currentId,
          past: stillCurrent ? [] : state.past,
          future: stillCurrent ? [] : state.future,
          newMapOpen: stillCurrent && !currentId,
        }
      })
    },

    duplicateMap: (id) => {
      const src = get().systems[id]
      if (!src) return
      const copy: SystemMap = JSON.parse(JSON.stringify(src))
      copy.meta = { ...copy.meta, id: uid(), title: `${src.meta.title} (copy)`, updatedAt: Date.now() }
      delete copy.meta.remoteId // a duplicate gets its own identity — no shared token
      set((state) => {
        const systems = { ...state.systems, [copy.meta.id]: copy }
        saveSystems(systems)
        return { systems }
      })
    },

    importMap: (text) => {
      const parsed = parseImport(text)
      if (!parsed) return 'File is not a valid metro system JSON.'
      // avoid id collision
      if (get().systems[parsed.meta.id]) parsed.meta.id = uid()
      set((state) => {
        const systems = { ...state.systems, [parsed.meta.id]: parsed }
        saveSystems(systems)
        return {
          systems,
          currentId: parsed.meta.id,
          past: [],
          future: [],
          selectedLineId: null,
          selectedStationId: null,
          activePath: null,
          newMapOpen: false,
          drawerOpen: false,
        }
      })
      saveCurrentId(parsed.meta.id)
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
          saveSystems(systems)
          return { systems }
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
            saveSystems(systems)
            saveCurrentId(remote.meta.id)
            return {
              systems,
              currentId: remote.meta.id,
              selectedLineId: null,
              selectedStationId: null,
              activePath: null,
              past: [],
              future: [],
              newMapOpen: false,
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
        saveSystems(systems)
        set({ systems })
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
