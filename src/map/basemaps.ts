import type { BasemapDef } from '../types'

interface RasterOverlay {
  id: string
  tiles: string[]
  attribution: string
  opacity?: number
}

function rasterStyle(tiles: string[], attribution: string, overlays: RasterOverlay[] = []) {
  return {
    version: 8 as const,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      base: { type: 'raster' as const, tiles, tileSize: 256, attribution },
      ...Object.fromEntries(
        overlays.map((o) => [
          o.id,
          { type: 'raster' as const, tiles: o.tiles, tileSize: 256, attribution: o.attribution },
        ]),
      ),
    },
    layers: [
      {
        id: 'bg',
        type: 'background' as const,
        paint: { 'background-color': '#d5dee6' },
      },
      { id: 'base', type: 'raster' as const, source: 'base' },
      ...overlays.map((o) => ({
        id: o.id,
        type: 'raster' as const,
        source: o.id,
        paint: { 'raster-opacity': o.opacity ?? 1 },
      })),
    ],
  }
}

const OFM_FONTS = { regular: 'Noto Sans Regular', bold: 'Noto Sans Bold' }
const CARTO_FONTS = { regular: 'Open Sans Regular', bold: 'Open Sans Semibold' }

/** Keyless basemap registry. Order = order in the switcher. */
export const BASEMAPS: BasemapDef[] = [
  {
    id: 'liberty',
    label: 'Liberty',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    dark: false,
    fonts: OFM_FONTS,
  },
  {
    id: 'positron',
    label: 'Positron',
    style: 'https://tiles.openfreemap.org/styles/positron',
    dark: false,
    fonts: OFM_FONTS,
  },
  {
    id: 'bright',
    label: 'Bright',
    style: 'https://tiles.openfreemap.org/styles/bright',
    dark: false,
    fonts: OFM_FONTS,
  },
  {
    id: 'fiord',
    label: 'Dark (Fiord)',
    style: 'https://tiles.openfreemap.org/styles/fiord',
    dark: true,
    fonts: OFM_FONTS,
  },
  {
    id: 'carto-light',
    label: 'Carto light',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    dark: false,
    fonts: CARTO_FONTS,
  },
  {
    id: 'carto-dark',
    label: 'Carto dark',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    dark: true,
    fonts: CARTO_FONTS,
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    style: rasterStyle(
      ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      '© OpenStreetMap contributors',
    ),
    dark: false,
    fonts: OFM_FONTS,
  },
  {
    id: 'railways',
    label: 'Railways',
    style: rasterStyle(
      [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      '© OpenStreetMap contributors',
      [
        {
          id: 'rails',
          tiles: [
            'https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
            'https://b.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
            'https://c.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
          ],
          attribution: '© OpenRailwayMap (CC-BY-SA)',
          opacity: 0.9,
        },
      ],
    ),
    dark: false,
    fonts: OFM_FONTS,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    style: rasterStyle(
      [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      'Esri, Maxar, Earthstar Geographics',
    ),
    dark: true,
    fonts: OFM_FONTS,
  },
]

export function basemapById(id: string): BasemapDef {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0]
}
