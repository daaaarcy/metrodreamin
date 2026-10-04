import { useEffect } from 'react'
import { MapView } from './map/MapView'
import { MapActions } from './ui/MapActions'
import { FocusPanel } from './ui/FocusPanel'
import { StationShortcut } from './ui/StationShortcut'
import { Sidebar } from './ui/Sidebar'
import { MapListDrawer } from './ui/MapListDrawer'
import { NewMapDialog } from './ui/NewMapDialog'
import { SearchBox } from './ui/SearchBox'
import { useStore } from './state/store'
import { remoteIdFromHash } from './state/remote'
import { flyTo } from './map/mapRef'

export default function App() {
  const theme = useStore((s) => s.theme)
  const sidebarOpen = useStore((s) => s.sidebarOpen)

  // load the map a #m=<token> link points at, and pull newer remote copies of
  // any synced maps (works on any port — the store server holds the data)
  useEffect(() => {
    const hydrate = () => useStore.getState().hydrateRemote(remoteIdFromHash())
    hydrate()
    window.addEventListener('hashchange', hydrate)
    return () => window.removeEventListener('hashchange', hydrate)
  }, [])

  return (
    <div className={`theme-${theme} flex h-full w-full overflow-hidden text-fg`}>
      <div className="relative flex-1 min-w-0">
        <MapView />
        <div className="absolute top-3 left-3 right-3 z-20 flex items-start gap-2 pointer-events-none">
          <MapActions />
          <div className="panel px-2 py-1.5 w-56 pointer-events-auto hidden md:block">
            <SearchBox onSelect={(r) => flyTo(r.lng, r.lat, r.zoom)} />
          </div>
        </div>
        <FocusPanel />
        <StationShortcut />
      </div>
      {sidebarOpen && <Sidebar />}
      <MapListDrawer />
      <NewMapDialog />
    </div>
  )
}
