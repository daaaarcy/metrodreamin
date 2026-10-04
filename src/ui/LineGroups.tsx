import { useMemo, useState } from 'react'
import { useStore, useSystem } from '../state/store'
import { lineGroupsView, type LineGroupView } from '../data/groups'
import { luminance } from '../data/colors'
import { stopIds } from '../geo/stats'

export function LineGroups() {
  const system = useSystem()
  const selectedLineId = useStore((s) => s.selectedLineId)
  const hiddenGroups = useStore((s) => s.hiddenGroups)
  const selectLine = useStore((s) => s.selectLine)
  const selectStation = useStore((s) => s.selectStation)
  const addLine = useStore((s) => s.addLine)
  const addLineGroup = useStore((s) => s.addLineGroup)
  const renameLineGroup = useStore((s) => s.renameLineGroup)
  const deleteLineGroup = useStore((s) => s.deleteLineGroup)
  const toggleGroupHidden = useStore((s) => s.toggleGroupHidden)
  const beginDrag = useStore((s) => s.beginDrag)
  const endDrag = useStore((s) => s.endDrag)

  const groups = useMemo(() => (system ? lineGroupsView(system) : []), [system])
  // collapsed by default for very large maps (MD behavior), decided once
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const st = useStore.getState()
    const sys0 = st.currentId ? st.systems[st.currentId] : undefined
    if (!sys0) return {}
    const gs = lineGroupsView(sys0)
    const custom = gs.filter((g) => g.custom).length
    if (Object.keys(sys0.lines).length > 100 || custom > 10) {
      return Object.fromEntries(gs.map((g) => [g.key, true]))
    }
    return {}
  })
  const [editing, setEditing] = useState<string | null>(null)

  if (!system) return null
  const toggle = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }))

  const lineRow = (g: LineGroupView) =>
    g.lines.map((line) => {
      const sel = line.id === selectedLineId
      return (
        <button
          key={line.id}
          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer ${sel ? '' : 'hover:bg-hover'}`}
          style={
            sel
              ? {
                  backgroundColor: line.color,
                  color: luminance(line.color) > 0.55 ? '#111' : '#fff',
                }
              : {}
          }
          onClick={() => {
            selectLine(line.id)
            selectStation(null)
          }}
        >
          <span
            className="w-3 h-3 rounded-full border border-line shrink-0"
            style={{ backgroundColor: line.color }}
          />
          <span className="flex-1 truncate">{line.name}</span>
          <span className={`text-[11px] ${sel ? 'opacity-70' : 'text-muted'}`}>
            {stopIds(system, line).size}
          </span>
        </button>
      )
    })

  return (
    <div>
      <div className="label mb-1">Lines</div>
      <div className="space-y-2">
        {groups.map((g) => {
          const isCollapsed = !!collapsed[g.key]
          const isHidden = hiddenGroups.includes(g.key)
          return (
            <div key={g.key}>
              <div className="flex items-center gap-1">
                <button
                  className="text-xs text-muted w-4 cursor-pointer"
                  title={isCollapsed ? 'Expand group' : 'Collapse group'}
                  onClick={() => toggle(g.key)}
                >
                  {isCollapsed ? '▸' : '▾'}
                </button>
                <button
                  className={`text-xs cursor-pointer ${isHidden ? 'opacity-40' : ''}`}
                  title={isHidden ? 'Show group on map' : 'Hide group on map'}
                  onClick={() => toggleGroupHidden(g.key)}
                >
                  👁
                </button>
                {g.custom && editing === g.key ? (
                  <input
                    className="input flex-1 !py-0.5 text-sm"
                    autoFocus
                    value={system.lineGroups?.[g.key]?.label ?? ''}
                    onFocus={beginDrag}
                    onChange={(e) => renameLineGroup(g.key, e.target.value)}
                    onBlur={() => {
                      if (!(system.lineGroups?.[g.key]?.label ?? '').trim()) {
                        renameLineGroup(g.key, 'Group Name')
                      }
                      endDrag()
                      setEditing(null)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                ) : (
                  <span
                    className={`flex-1 text-sm font-medium truncate ${isHidden ? 'text-muted line-through' : ''}`}
                  >
                    {g.label}
                  </span>
                )}
                {g.custom && editing !== g.key && (
                  <>
                    <button
                      className="text-xs text-muted hover:text-fg cursor-pointer"
                      title="Rename group"
                      onClick={() => setEditing(g.key)}
                    >
                      ✎
                    </button>
                    <button
                      className="text-xs text-muted hover:text-red-500 cursor-pointer"
                      title="Delete line group (keeps lines)"
                      onClick={() => deleteLineGroup(g.key)}
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
              {!isCollapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {lineRow(g)}
                  <button
                    className="w-full text-left text-xs text-muted hover:text-fg px-2 py-1 cursor-pointer"
                    onClick={() =>
                      addLine(undefined, g.custom ? { groupId: g.key } : { mode: g.mode })
                    }
                  >
                    + Add new line
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button
        className="w-full text-left text-xs text-muted hover:text-fg px-2 py-1.5 mt-1 cursor-pointer"
        onClick={() => addLineGroup()}
      >
        + Add custom line group
      </button>
    </div>
  )
}
