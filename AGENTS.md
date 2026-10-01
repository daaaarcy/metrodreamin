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

- `src/types.ts` — `SystemMap` (stations/lines/interchanges), `Line`, `MapPoint`,
  `ActivePath` (`lineId + branchIndex + end` = drawing cursor), `LineBranch`.
- `src/state/store.ts` — Zustand + immer. `mutate()` = undoable + persisted + bumps
  `meta.updatedAt`; `transient()` = same but no history frame (mid-drag, typing — callers
  wrap sessions in `beginDrag`/`endDrag` which commit one frame). Undo cap 200.
- `src/state/persistence.ts` — localStorage keys `md.systems.v1`, `md.current.v1`,
  `md.settings.v1`; `parseImport` validates JSON imports.
- `src/state/remote.ts` + `server/store.mjs` — optional sync. `meta.remoteId` marks a
  synced map; a store subscriber pushes debounced PUTs; `hydrateRemote` loads `#m=<token>`
  links and adopts newer remote copies on boot. Data dir `server-data/` is gitignored.
- `src/geo/` — `curves.ts` (Catmull-Rom smoothing, haversine, `nearestOnPolyline`),
  `stats.ts` (`linePaths`, `isLoop`, km/time/cost/ridership heuristics), `query.ts`
  (hit-testing, `terminusRole`, `activePathEndId`, `linesThrough`).
- `src/map/` — `MapView.tsx` (map init + all click/drag interaction), `buildGeo.ts`
  (GeoJSON), `layers.ts` (layer defs), `basemaps.ts` (keyless providers + per-provider
  fontstacks), `vehicles.ts` (animator), `mapRef.ts` (`mapApi`/`flyTo` handle).
- `src/ui/` — TopBar, LinesPanel, LinePanel, StationPanel, ScorePanel, MapListDrawer,
  NewMapDialog, SearchBox (Nominatim).
- `src/data/` — `modes.ts` (11 modes), `colors.ts` (21 base colors + icon patterns).
- `public/demo.json` — built-in demo map; `public/maplibre-gl-*.mjs` — vendored worker.

## Interaction model (be careful — regressions here corrupt user maps)

- **Drawing is armed only by an explicit draw action**: `addLine`/`addLine(fromStation)`,
  terminus click, `forkLine`, or an empty-map click that appends a point. Armed state =
  `activePath !== null`. `selectLine` does NOT arm drawing (it used to — that bug made
  station clicks silently append stations to lines).
- While armed: clicking a station/waypoint appends that point to the path (shared
  stations/loops). While not armed: station click = select + switch line context.
- Esc disarms and clears selection. Every mutation must stay undoable.

## Conventions / gotchas

- **Stations vs waypoints are the same `MapPoint`** — presence of `name` makes it a
  station. Per-line "pass through" = `line.waypointOverrides`.
- **Branch paths** = `[rootStationId, ...branch.stationIds]`; `insertIndex` in
  `nearestSegment` already accounts for the root (splice directly).
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
  (`mutate`/`transient`, `pathIds`, `linesThrough`) rather than re-implementing.

## Git

- Commit style: concise message focused on why; this repo is authored with Devin.
- `server-data/`, `dist/`, `node_modules/`, `.playwright-mcp/` are gitignored.
