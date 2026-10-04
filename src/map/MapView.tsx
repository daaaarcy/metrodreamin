import { useEffect, useMemo, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// maplibre's default worker URL resolution breaks under bundlers — serve the
// worker + its shared chunk from /public instead.
maplibregl.config.WORKER_URL = '/maplibre-gl-worker.mjs'
import type { Feature, FeatureCollection } from 'geojson'
import { useStore, useSystem } from '../state/store'
import { basemapById } from './basemaps'
import { ensureOverlay, LYR_STATIONS, LYR_WAYPOINTS, LYR_WAYPOINTS_SELECTED, LYR_LINES, SRC_LINES, SRC_STATIONS, SRC_WAYPOINTS, SRC_LINKS, SRC_PREVIEW } from './layers'
import { buildGeo } from './buildGeo'
import { mapApi } from './mapRef'
import { VehicleAnimator } from './vehicles'
import { linePaths, pathCoords, isLoop } from '../geo/stats'
import { smoothPath } from '../geo/curves'
import { MODE_BY_ID } from '../data/modes'
import { groupKey } from '../data/groups'
import { nearestSegment, pathEndpoint, terminusRole, linesThrough, activePathEndId } from '../geo/query'

const HIT_STATION = 10
const HIT_LINE = 9

function bbox(p: maplibregl.Point, pad: number): [maplibregl.PointLike, maplibregl.PointLike] {
  return [
    [p.x - pad, p.y - pad],
    [p.x + pad, p.y + pad],
  ]
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const animatorRef = useRef<VehicleAnimator | null>(null)
  const dragIdRef = useRef<string | null>(null)

  const system = useSystem()
  const selectedStationId = useStore((s) => s.selectedStationId)
  const selectedLineId = useStore((s) => s.selectedLineId)
  const basemapId = useStore((s) => s.basemapId)
  const hideWaypoints = useStore((s) => s.hideWaypoints)
  const vehiclesOn = useStore((s) => s.vehiclesOn)
  const activePath = useStore((s) => s.activePath)
  const hiddenGroups = useStore((s) => s.hiddenGroups)

  const geo = useMemo(() => {
    if (!system) return null
    const hiddenLineIds = new Set(
      Object.values(system.lines)
        .filter((l) => hiddenGroups.includes(groupKey(system, l)))
        .map((l) => l.id),
    )
    return buildGeo(system, selectedStationId, selectedLineId, hiddenLineIds)
  }, [system, selectedStationId, selectedLineId, hiddenGroups])
  const geoRef = useRef(geo)
  geoRef.current = geo
  const appliedBasemap = useRef<string | null>(null)

  // ---- map init (once) ----
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const bm = basemapById(useStore.getState().basemapId)
    appliedBasemap.current = bm.id
    const map = new maplibregl.Map({
      container,
      style: bm.style as maplibregl.StyleSpecification | string,
      center: [-74.006, 40.7128],
      zoom: 11,
      attributionControl: { compact: true },
    })
    mapApi.map = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new maplibregl.ScaleControl({}), 'bottom-left')

    const animator = new VehicleAnimator(map)
    animatorRef.current = animator

    // sidebar toggles / window resizes change the map box — keep it in sync
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(container)

    const refreshOverlay = () => {
      ensureOverlay(map, basemapById(useStore.getState().basemapId))
      pushData()
      pushVehicles()
      updateWaypointVisibility()
    }
    map.on('load', refreshOverlay)
    map.on('styledata', refreshOverlay)

    const setGeo = (id: string, data: FeatureCollection) => {
      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined
      src?.setData(data)
    }
    const pushData = () => {
      const g = geoRef.current
      if (!g) return
      setGeo(SRC_LINES, g.lines)
      setGeo(SRC_STATIONS, g.stations)
      setGeo(SRC_WAYPOINTS, g.waypoints)
      setGeo(SRC_LINKS, g.interchangeLinks)
    }
    const pushVehicles = () => {
      const s = useStore.getState()
      const sys = s.currentId ? s.systems[s.currentId] : undefined
      if (!sys) return
      animator.setTracks(
        Object.values(sys.lines)
          .filter((line) => !s.hiddenGroups.includes(groupKey(sys, line)))
          .flatMap((line) =>
          linePaths(line).map((ids) => ({
            color: line.color,
            coords: smoothPath(pathCoords(sys, ids), isLoop(line) && ids === line.stationIds),
            kmh: MODE_BY_ID[line.mode]?.speedKmh ?? 38,
          })),
        ),
      )
    }
    const updateWaypointVisibility = () => {
      const hide = useStore.getState().hideWaypoints
      for (const id of [LYR_WAYPOINTS, LYR_WAYPOINTS_SELECTED]) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', hide ? 'none' : 'visible')
        }
      }
    }
    ;(map as unknown as Record<string, unknown>).__mdPushVehicles = pushVehicles
    ;(map as unknown as Record<string, unknown>).__mdWaypointVis = updateWaypointVisibility
    ;(map as unknown as Record<string, unknown>).__mdPushData = pushData

    // ---- interaction ----
    let dragMoved = false
    const onDragMove = (ev: maplibregl.MapMouseEvent) => {
      const id = dragIdRef.current
      if (!id) return
      dragMoved = true
      useStore.getState().movePoint(id, ev.lngLat.lng, ev.lngLat.lat)
    }
    const onDragEnd = () => {
      map.off('mousemove', onDragMove)
      map.dragPan.enable()
      map.getCanvas().style.cursor = ''
      if (dragMoved) useStore.getState().endDrag()
      else {
        // treat as plain click
        dragIdRef.current = null
        return
      }
      dragIdRef.current = null
      dragMoved = false
    }

    map.on('mousedown', (e: maplibregl.MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(bbox(e.point, HIT_STATION), {
        layers: [LYR_STATIONS, LYR_WAYPOINTS, 'md-transfer-inner'],
      })
      if (!hits.length) return
      e.preventDefault()
      dragIdRef.current = hits[0].properties.id as string
      dragMoved = false
      useStore.getState().beginDrag()
      map.dragPan.disable()
      map.getCanvas().style.cursor = 'grabbing'
      map.on('mousemove', onDragMove)
      map.once('mouseup', onDragEnd)
    })

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      const st = useStore.getState()
      const sys = st.currentId ? st.systems[st.currentId] : undefined
      if (!sys) return

      // 1) station / waypoint
      const stationHits = map.queryRenderedFeatures(bbox(e.point, HIT_STATION), {
        layers: [LYR_STATIONS, LYR_WAYPOINTS, 'md-transfer-inner'],
      })
      if (stationHits.length) {
        const pid = stationHits[0].properties.id as string
        if (st.pendingInterchangeFrom) {
          st.createInterchange(st.pendingInterchangeFrom, pid)
          return
        }
        // While actively drawing, clicking any existing point links it into
        // the path (this is how shared/transfer stations are made). Drawing
        // is armed only by an explicit draw action — never by mere selection.
        const ap = st.activePath
        if (ap && sys.lines[ap.lineId] && activePathEndId(sys, ap) !== pid) {
          st.appendExistingPoint(pid)
          return
        }
        const term = terminusRole(sys, pid, st.selectedLineId)
        if (term) {
          // clicking a terminus arms drawing from that end
          st.selectLine(term.lineId)
          st.setActivePath(term)
        } else {
          // switch edit context to the clicked station's line (no drawing)
          const mine = linesThrough(sys, pid)
          const lid = mine.some((l) => l.id === st.selectedLineId)
            ? st.selectedLineId
            : (mine[0]?.id ?? null)
          if (lid && lid !== st.selectedLineId) {
            st.selectLine(lid)
          }
        }
        st.selectStation(pid)
        return
      }

      // 2) line segment → insert waypoint
      const lineHits = map.queryRenderedFeatures(bbox(e.point, HIT_LINE), {
        layers: [LYR_LINES],
      })
      if (lineHits.length) {
        const seg = nearestSegment(sys, map, e.lngLat)
        if (seg) {
          const prevPath = st.activePath
          st.insertPointOnLine(seg.lineId, seg.branchIndex, seg.insertIndex, seg.lng, seg.lat)
          st.selectLine(seg.lineId)
          // keep drawing where the user was drawing
          st.setActivePath(
            prevPath ?? { lineId: seg.lineId, branchIndex: seg.branchIndex, end: 'end' },
          )
          return
        }
      }

      // 3) empty space → extend active path / selected line / new line
      st.addPoint(e.lngLat.lng, e.lngLat.lat)
    })

    // live preview from active path end to cursor
    map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
      if (dragIdRef.current) return
      const st = useStore.getState()
      const sys = st.currentId ? st.systems[st.currentId] : undefined
      const ap = st.activePath
      const src = map.getSource(SRC_PREVIEW) as maplibregl.GeoJSONSource | undefined
      if (!src) return
      if (!sys || !ap) {
        src.setData({ type: 'FeatureCollection', features: [] })
        return
      }
      const from = pathEndpoint(sys, ap.lineId, ap.branchIndex, ap.end)
      if (!from) {
        src.setData({ type: 'FeatureCollection', features: [] })
        return
      }
      const features: Feature[] = [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [from.lng, from.lat],
              [e.lngLat.lng, e.lngLat.lat],
            ],
          },
          properties: { kind: 'line' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
          properties: { kind: 'dot' },
        },
      ]
      src.setData({ type: 'FeatureCollection', features })

      // pointer affordance
      const hover = map.queryRenderedFeatures(bbox(e.point, HIT_STATION), {
        layers: [LYR_STATIONS, LYR_WAYPOINTS, 'md-transfer-inner'],
      })
      map.getCanvas().style.cursor = hover.length ? 'pointer' : 'crosshair'
    })

    const keydown = (ev: KeyboardEvent) => {
      const st = useStore.getState()
      // ⌘S/Ctrl+S works even while typing in a field — never show the browser dialog
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') {
        ev.preventDefault()
        void st.save()
        return
      }
      const target = ev.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault()
        if (ev.shiftKey) st.redo()
        else st.undo()
      } else if (ev.key === 'Escape') {
        st.selectStation(null)
        st.selectLine(null)
        st.setActivePath(null)
        st.setPendingInterchange(null)
      } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && st.selectedStationId) {
        st.deletePoint(st.selectedStationId)
      }
    }
    window.addEventListener('keydown', keydown)

    return () => {
      window.removeEventListener('keydown', keydown)
      ro.disconnect()
      animator.stop()
      mapApi.map = null
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- basemap switch ----
  useEffect(() => {
    const map = mapApi.map
    if (!map || appliedBasemap.current === basemapId) return
    appliedBasemap.current = basemapId
    map.setStyle(basemapById(basemapId).style as maplibregl.StyleSpecification | string, {
      diff: false,
    })
  }, [basemapId])

  // ---- push data on change ----
  useEffect(() => {
    const map = mapApi.map
    if (!map || !map.isStyleLoaded()) return
    const push = (map as unknown as Record<string, () => void>).__mdPushData
    push?.()
    const pushV = (map as unknown as Record<string, () => void>).__mdPushVehicles
    pushV?.()
  }, [geo])

  useEffect(() => {
    const map = mapApi.map
    if (!map || !map.isStyleLoaded()) return
    const fn = (map as unknown as Record<string, () => void>).__mdWaypointVis
    fn?.()
  }, [hideWaypoints])

  useEffect(() => {
    const animator = animatorRef.current
    if (!animator) return
    if (vehiclesOn) animator.start()
    else animator.stop()
  }, [vehiclesOn])

  // hint line: tell the user what clicking does
  const hint = useMemo(() => {
    const sys = system
    if (!sys) return null
    if (!Object.keys(sys.lines).length) return 'Tap the map to start your first line'
    if (activePath) return 'Tap the map or an existing station to extend the line — Esc to stop'
    return null
  }, [system, activePath])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {hint && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 panel px-4 py-2 text-sm text-muted pointer-events-none">
          {hint}
        </div>
      )}
    </div>
  )
}
