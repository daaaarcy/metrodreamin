# AGENTS.md — MetroDreamer

Local-first clone of metrodreamin.com: a fantasy metro map editor. No accounts, no backend
required for core features. Optional local sync server for cross-port share links.

## Commands

```sh
npm run dev      # dev server (vite) — use for development/testing
npm run play     # production build pinned to http://localhost:4000 — the user's play URL
npm run store    # map-sync server on http://127.0.0.1:8734 (share links) — node, no deps
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npx tsc -b       # typecheck only
```

## Verify before finishing

1. `npx tsc -b` and `npm run build` must be clean.
2. `npm run lint` should show no errors (one known warning in `src/ui/SearchBox.tsx` is
   pre-existing).
3. For map-interaction changes, smoke-test in a real browser (Playwright MCP). Debug
   handles on `window`: `__mapApi.map` (MapLibre instance), `__mdStore` (zustand store).

## IMPORTANT — where to test

- The user plays on `http://localhost:4000`. Never run automated clicks against it —
  treat port 4000 and the preview proxy `http://127.0.0.1:*` as the user's session.
- Test only against `npm run dev` (e.g. :5199) or a throwaway port, in a separate browser
  context. localStorage is origin-scoped, but don't scribble on `demo` data even there —
  reset it from `/demo.json` after testing.

## Architecture

- `src/types.ts` — `SystemMap` (stations/lines/interchanges/lineGroups, `meta.caption`,
  `meta.version`, `meta.branchedFrom`), `Line` (`groupId`), `MapPoint` (`waypoint`),
  `LineGroup`, `LineBranch`.
- `src/state/store.ts` — Zustand + immer. `mutate()` = undoable + persisted + bumps
  `meta.updatedAt`; `transient()` = same but no history frame (mid-drag, typing — callers
  wrap sessions in `beginDrag`/`endDrag` which commit one frame). Undo cap 200.
  `nameHints` = reverse-geocoded station-name suggestions (UI-only, never persisted).
- `src/state/persistence.ts` — localStorage keys `md.systems.v1`, `md.current.v1`,
  `md.settings.v1` (basemap, theme, autoName, sidebarOpen, per-map `hiddenGroups`);
  `parseImport` validates JSON imports. `normalizeSystem` runs on every load/import/fetch:
  v1→v2 marks unnamed points `waypoint: true` (one-time, gated by `meta.version`).
- Saving: autosave on every mutation (`saveStatus` tracks success/quota errors); `save()`
  (Save button / ⌘S) flushes + immediately pushes synced maps (`pushRemoteNow`).
- `src/state/mdImport.ts` + `GET /import?url=` on the store server — imports
  metrodreamin.com `/view/` and `/edit/` links (reads `__NEXT_DATA__`; host allowlisted).
- `src/state/remote.ts` + `server/store.mjs` — optional sync. `meta.remoteId` marks a
  synced map; a store subscriber pushes debounced PUTs; `hydrateRemote` loads `#m=<token>`
  links and adopts newer remote copies on boot. Data dir `server-data/` is gitignored.
- `src/geo/` — `curves.ts` (Catmull-Rom smoothing, haversine, mercator helpers),
  `stats.ts` (`linePaths`, `isLoop`, `allPointIds`, km/time/cost/ridership
  heuristics), `query.ts` (hit-testing, `terminusRole`, `linesThrough`,
  `bestInsertIndex` = MD's add-to-line placement, `nearestLines`, `canMakeLoop`),
  `reverse.ts` (Nominatim reverse geocoding for name suggestions, ≥1.1s apart).
- `src/map/` — `MapView.tsx` (map init + all click/drag interaction + waypoint-mode
  banner), `buildGeo.ts` (GeoJSON), `layers.ts` (layer defs), `basemaps.ts` (keyless
  providers + raster overlays like OpenRailwayMap + per-provider fontstacks),
  `vehicles.ts` (animator), `mapRef.ts` (`mapApi`/`flyTo` handle).
- `src/ui/` — MetroDreamin-style layout: `MapActions` (icon bar: save, undo, modes,
  basemap, theme…), `Sidebar` (title, stats, `LineGroups`, caption), `FocusPanel` →
  `StationPanel`/`LinePanel`, `StationShortcut` (popup by the selected point),
  `MapListDrawer`, `NewMapDialog`, `MdImportForm`, `SearchBox` (Nominatim).
- Theme: CSS vars on `.theme-dark`/`.theme-light` exposed as `text-fg`, `text-muted`,
  `bg-subtle`, `hover:bg-hover`, `border-line`, `bg-accent`, `.is-on` — never hard-code
  `black/…`/`bg-white` in UI.
- `src/data/` — `modes.ts` (11 modes), `colors.ts` (MD's 21 `DEFAULT_LINES` names/colors,
  icon patterns, `luminance`), `groups.ts` (`sortLines`, `groupKey` = `groupId ?? mode`,
  `lineGroupsView`).
- `public/demo.json` — built-in demo map; `public/maplibre-gl-*.mjs` — vendored worker.

## Interaction model (be careful — regressions here corrupt user maps)

- **Map clicks create standalone points** — a station, or a waypoint while the
  sticky `addingWaypoints` mode is armed. They never join lines; there is no
  drawing cursor / active path.
- Points attach to lines only via **"Add to X" actions** (the station shortcut
  popup + the station panel), which place them at `bestInsertIndex`. Station
  click = select + popup. `selectLine` only sets editing context.
- `convertPoint` toggles the sticky mode: station→waypoint deletes the name,
  drops the point from interchanges, and arms waypoint placement (a bottom
  banner shows while armed); waypoint→station disarms it.
- New stations are **nameless** — the player names them. Reverse geocoding
  (`suggestName`) only fills the "Suggest" chip in `nameHints`.
- Esc clears selection + pending interchange. Every mutation must stay undoable.

## Conventions / gotchas

- **Stations vs waypoints are the same `MapPoint`** — `p.waypoint === true` makes it a
  waypoint; `name` is NOT the discriminator (stations can be nameless). Per-line
  "pass through" = `line.waypointOverrides`.
- **Branch paths** = `[rootStationId, ...branch.stationIds]` (see `linePaths`).
- **MapLibre worker** must stay served from `public/` via
  `maplibregl.config.WORKER_URL = '/maplibre-gl-worker.mjs'` — bundler resolution breaks.
- **Map container** uses inline `position:absolute; inset:0` — MapLibre's own CSS beats
  Tailwind position utilities (unlayered vs layered).
- **Label fonts are per-basemap-provider** (`fonts.regular/bold` in `BasemapDef`) — glyph
  servers 404 on multi-font stacks.
- Sync server (`server/store.mjs`): token = capability, no auth; only accepts
  `[A-Za-z0-9_-]` ids; CORS `*` so any localhost port can sync.
- `duplicateMap` must NOT copy `remoteId` (a copy gets its own identity).
- Compact code, no gratuitous comments, match existing style; use existing helpers
  (`mutate`/`transient`, `linePaths`, `linesThrough`) rather than re-implementing.

## Git

- Commit style: concise message focused on why; this repo is authored with Devin.
- `server-data/`, `dist/`, `node_modules/`, `.playwright-mcp/` are gitignored.
