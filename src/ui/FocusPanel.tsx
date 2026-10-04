import { useStore, useSystem } from '../state/store'
import { LinePanel } from './LinePanel'
import { StationPanel } from './StationPanel'

/** Left-side edit panel: the selected point or line, else nothing. */
export function FocusPanel() {
  const system = useSystem()
  const selectedStationId = useStore((s) => s.selectedStationId)
  const selectedLineId = useStore((s) => s.selectedLineId)

  if (!system) return null
  if (selectedStationId && system.stations[selectedStationId]) {
    return <StationPanel stationId={selectedStationId} />
  }
  if (selectedLineId && system.lines[selectedLineId]) {
    return <LinePanel line={system.lines[selectedLineId]} />
  }
  return null
}
