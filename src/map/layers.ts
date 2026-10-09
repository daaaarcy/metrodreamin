import type * as maplibregl from 'maplibre-gl'
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl'
import { ensureIcons } from './icons'
import type { BasemapDef } from '../types'

export const SRC_LINES = 'md-lines'
export const SRC_STATIONS = 'md-stations'
export const SRC_WAYPOINTS = 'md-waypoints'
export const SRC_LINKS = 'md-links'
export const SRC_VEHICLES = 'md-vehicles'

export const LYR_STATIONS = 'md-stations'
export const LYR_WAYPOINTS = 'md-waypoints'
export const LYR_WAYPOINTS_SELECTED = 'md-waypoints-selected'
export const LYR_LINES = 'md-lines-main'

const emptyFC = { type: 'FeatureCollection' as const, features: [] }

function sources(): Record<string, SourceSpecification> {
  return {
    [SRC_LINES]: { type: 'geojson', data: emptyFC },
    [SRC_STATIONS]: { type: 'geojson', data: emptyFC },
    [SRC_WAYPOINTS]: { type: 'geojson', data: emptyFC },
    [SRC_LINKS]: { type: 'geojson', data: emptyFC },
    [SRC_VEHICLES]: { type: 'geojson', data: emptyFC },
  }
}

function layers(dark: boolean, fonts?: { regular: string; bold: string }): LayerSpecification[] {
  const font = [fonts?.regular ?? 'Noto Sans Regular']
  const fontBold = [fonts?.bold ?? 'Noto Sans Bold']
  const halo = dark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)'
  const stationText = dark ? '#f2f2f2' : '#222'
  const casing = 'rgba(15,15,20,0.35)'
  return [
    {
      id: 'md-links',
      type: 'line',
      source: SRC_LINKS,
      paint: {
        'line-color': dark ? '#e8e8e8' : '#333',
        'line-width': 2,
        'line-dasharray': [1.5, 1.5],
        'line-opacity': 0.8,
      },
    },
    {
      id: 'md-lines-selected',
      type: 'line',
      source: SRC_LINES,
      filter: ['==', ['get', 'selected'], 1],
      paint: {
        'line-color': '#4da3ff',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3,
          6,
          10,
          11,
          16,
          16,
        ],
        'line-opacity': 0.25,
        'line-blur': 3,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    },
    {
      id: 'md-lines-casing',
      type: 'line',
      source: SRC_LINES,
      paint: {
        'line-color': casing,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 3.5, 10, 7, 16, 11],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    },
    {
      id: LYR_LINES,
      type: 'line',
      source: SRC_LINES,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2, 10, 5, 16, 8],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    },
    {
      id: 'md-line-icons',
      type: 'symbol',
      source: SRC_LINES,
      filter: ['!=', ['get', 'icon'], 'solid'],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 26,
        'icon-image': ['concat', 'mdi-', ['get', 'icon']],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.12, 10, 0.18, 16, 0.26],
        'icon-allow-overlap': false,
        'icon-ignore-placement': false,
      },
      paint: { 'icon-color': '#ffffff', 'icon-opacity': 0.95 },
    },
    {
      id: 'md-line-labels',
      type: 'symbol',
      source: SRC_LINES,
      filter: ['!=', ['get', 'name'], ''],
      minzoom: 9,
      layout: {
        'symbol-placement': 'line-center',
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-font': fontBold,
        'text-optional': true,
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': halo,
        'text-halo-width': 1.6,
      },
    },
    {
      id: LYR_WAYPOINTS,
      type: 'circle',
      source: SRC_WAYPOINTS,
      minzoom: 10,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 14, 2.6, 18, 3.6],
        'circle-color': '#ffffff',
        'circle-opacity': 0,
        'circle-stroke-color': dark ? '#e8e8e8' : '#333',
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.85,
      },
    },
    {
      id: LYR_WAYPOINTS_SELECTED,
      type: 'circle',
      source: SRC_WAYPOINTS,
      filter: ['==', ['get', 'selected'], 1],
      paint: {
        'circle-radius': 6,
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': '#4da3ff',
        'circle-stroke-width': 2,
      },
    },
    {
      id: 'md-transfer-ring',
      type: 'circle',
      source: SRC_STATIONS,
      filter: ['==', ['get', 'transfer'], 1],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 8, 16, 11],
        'circle-color': dark ? '#f2f2f2' : '#1a1a1a',
      },
    },
    {
      id: 'md-transfer-inner',
      type: 'circle',
      source: SRC_STATIONS,
      filter: ['==', ['get', 'transfer'], 1],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.4, 10, 5, 16, 7.4],
        'circle-color': dark ? '#1a1a1a' : '#ffffff',
      },
    },
    {
      id: LYR_STATIONS,
      type: 'circle',
      source: SRC_STATIONS,
      filter: ['==', ['get', 'transfer'], 0],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.2, 10, 4.5, 16, 6.5],
        'circle-color': '#ffffff',
        'circle-stroke-color': '#1a1a1a',
        'circle-stroke-width': 1.6,
      },
    },
    {
      id: 'md-stations-selected',
      type: 'circle',
      source: SRC_STATIONS,
      filter: ['==', ['get', 'selected'], 1],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 8, 16, 11],
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': '#4da3ff',
        'circle-stroke-width': 2.5,
      },
    },
    {
      id: 'md-station-labels',
      type: 'symbol',
      source: SRC_STATIONS,
      minzoom: 10,
      filter: ['!=', ['get', 'name'], ''],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10.5, 15, 12.5],
        'text-font': font,
        'text-offset': [0, 0.9],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': stationText,
        'text-halo-color': halo,
        'text-halo-width': 1.4,
      },
    },
    {
      id: 'md-vehicles',
      type: 'circle',
      source: SRC_VEHICLES,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.4, 10, 4.5, 16, 6],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    },
  ]
}

/**
 * Add our overlay sources/layers. Safe to call after every basemap style change —
 * existing ids are skipped. Call on 'load' and 'styledata'.
 */
export function ensureOverlay(map: maplibregl.Map, bm: Pick<BasemapDef, 'dark' | 'fonts'>) {
  ensureIcons(map)
  const srcs = sources()
  for (const [id, def] of Object.entries(srcs)) {
    if (!map.getSource(id)) map.addSource(id, def)
  }
  const existing = new Set((map.getStyle().layers ?? []).map((l: { id: string }) => l.id))
  for (const layer of layers(bm.dark, bm.fonts)) {
    if (!existing.has(layer.id)) map.addLayer(layer)
  }
}

/** Tear down overlay (before style swap to guarantee ordering). */
export function removeOverlay(map: maplibregl.Map) {
  const style = map.getStyle()
  for (const layer of style.layers ?? []) {
    if (layer.id.startsWith('md-')) map.removeLayer(layer.id)
  }
  for (const id of Object.keys(sources())) {
    if (map.getSource(id)) map.removeSource(id)
  }
}
