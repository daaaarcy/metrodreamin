# MetroDreamer

A local-first clone of [metrodreamin.com](https://metrodreamin.com) — a fantasy metro/transit
map editor. No accounts, no registration: everything lives in your browser's
localStorage, with JSON export/import and an optional local sync server for sharing.

## Run it

```sh
npm install
npm run dev      # development server
npm run play     # production build pinned to http://localhost:4000 (stable play URL)
npm run store    # local sync server on http://127.0.0.1:8734 (share links)
```

`npm run build` produces a static bundle in `dist/` you can host anywhere.

## Sync / share links (optional)

`npm run store` starts a tiny local server (no deps, no auth — the token is the key).
Click 🔗 in the top bar to register the open map and copy its `#m=<token>` link.
That link loads the same map on **any port or browser on this machine**, and edits
sync back automatically (debounced). Files live in `server-data/<id>.json`.
Unsynced maps still work purely from localStorage.

## What you can do

- **Draw lines** — click the map to place stations and waypoints; lines render as smooth
  curves (Catmull-Rom). Click a terminus to extend it, click mid-line to insert a waypoint,
  drag points to move them.
- **11 transit modes** — gondola, bus, tram, ferry, BRT, light rail, metro, commuter rail,
  regional rail, high speed rail, airliner — each with its own speed for ride-time estimates.
- **Styling** — 21 base colors + free hex color, icon patterns (circle/diamond/plus/heart/star),
  line names shown on the map.
- **Stations** — name them, set grade (elevated/at-grade/underground), make a line pass
  through without stopping (per-line waypoint), delete.
- **Branches** — select a mid-line station and hit "Branch" to fork the line.
- **Walking transfers** — link nearby stations into an interchange group.
- **Stats & score** — per-line length, ride time, construction-cost and ridership estimates
  (documented heuristics), plus a whole-map score.
- **Animated vehicles**, hide-waypoints toggle, undo/redo (⌘Z / ⇧⌘Z), place search.
- **Basemaps** — OpenFreeMap (Liberty/Positron/Bright/Fiord), CARTO light/dark, OSM raster,
  Esri satellite. All keyless; subject to providers' fair-use terms.

## Not included (needs a backend)

Explore feed, stars/likes, comments, user profiles, and the official real-world
starter templates. A small built-in demo system is offered instead.

## Data layout

```
localStorage['md.systems.v1']  — all systems (keyed by id)
localStorage['md.current.v1']  — open map id
localStorage['md.settings.v1'] — basemap, waypoint visibility, vehicles toggle
```

Export produces the raw `SystemMap` JSON; import accepts the same shape.

## Notes

- Map rendering uses MapLibre GL. Its web worker is served verbatim from `public/`
  (`config.WORKER_URL = '/maplibre-gl-worker.mjs'`) because the package's default
  `import.meta.url` worker resolution breaks under Vite/Rolldown.
- Geocoding uses OSM Nominatim — keep request volume modest.
