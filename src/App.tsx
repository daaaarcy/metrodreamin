import { useEffect } from 'react'
import { MapView } from './map/MapView'
import { TopBar } from './ui/TopBar'
import { LinesPanel } from './ui/LinesPanel'
import { ScorePanel } from './ui/ScorePanel'
import { MapListDrawer } from './ui/MapListDrawer'
import { NewMapDialog } from './ui/NewMapDialog'
import { useStore } from './state/store'
import { remoteIdFromHash } from './state/remote'

export default function App() {
  // load the map a #m=<token> link points at, and pull newer remote copies of
  // any synced maps (works on any port — the store server holds the data)
  useEffect(() => {
    const hydrate = () => useStore.getState().hydrateRemote(remoteIdFromHash())
    hydrate()
    window.addEventListener('hashchange', hydrate)
    return () => window.removeEventListener('hashchange', hydrate)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapView />
      <TopBar />
      <LinesPanel />
      <ScorePanel />
      <MapListDrawer />
      <NewMapDialog />
    </div>
  )
}
