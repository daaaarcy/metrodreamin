export type Grade = 'above' | 'at' | 'below'

export type LineIcon = 'solid' | 'circle' | 'diamond' | 'plus' | 'heart' | 'star'

export type ModeId =
  | 'gondola'
  | 'bus'
  | 'tram'
  | 'ferry'
  | 'brt'
  | 'lrt'
  | 'metro'
  | 'commuter'
  | 'regional'
  | 'hsr'
  | 'airliner'

/** A point on the map. Waypoints shape lines but aren't stops; the rest are stations. */
export interface MapPoint {
  id: string
  lng: number
  lat: number
  name?: string
  grade?: Grade
  waypoint?: boolean
}

export interface LineBranch {
  /** Mid-line point the branch forks from. */
  rootStationId: string
  /** Ordered points after the root. */
  stationIds: string[]
}

export interface Line {
  id: string
  name: string
  color: string
  icon?: LineIcon
  mode: ModeId
  /** Ordered point ids of the trunk path. If first === last the line is a loop. */
  stationIds: string[]
  /** Point ids this line passes through without stopping (per-line waypoints). */
  waypointOverrides?: string[]
  branches?: LineBranch[]
  /** Custom line group this line belongs to (falls back to its mode group). */
  groupId?: string
}

/** Walking transfer between two or more stations. */
export interface Interchange {
  id: string
  stationIds: string[]
}

/** A user-named group of lines (lines without one group by mode). */
export interface LineGroup {
  id: string
  label: string
}

export interface SystemMap {
  meta: {
    id: string
    title: string
    caption?: string
    createdAt: number
    updatedAt: number
    /** Data-model version; see SYSTEM_VERSION in persistence. */
    version?: number
    /** Token on the local store server — set when the map is shared/synced. */
    remoteId?: string
  }
  stations: Record<string, MapPoint>
  lines: Record<string, Line>
  interchanges: Record<string, Interchange>
  lineGroups?: Record<string, LineGroup>
}

export interface MapIndexEntry {
  id: string
  title: string
  updatedAt: number
  stationCount: number
  lineCount: number
}

/** Identifies the path a drawing action extends. branchIndex null = trunk. */
export interface ActivePath {
  lineId: string
  branchIndex: number | null
  end: 'start' | 'end'
}

export interface BasemapDef {
  id: string
  label: string
  /** MapLibre style URL or inline raster style. */
  style: string | object
  dark: boolean
  /** Fontstacks served by this basemap's glyph endpoint. */
  fonts?: { regular: string; bold: string }
}
