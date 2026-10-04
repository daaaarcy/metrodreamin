import { useState } from 'react'
import { useStore } from '../state/store'

/** Paste a metrodreamin.com /view or /edit link → import via the store server. */
export function MdImportForm() {
  const importMetroDreamin = useStore((s) => s.importMetroDreamin)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!url.trim() || busy) return
    setBusy(true)
    setError(null)
    const err = await importMetroDreamin(url.trim())
    setBusy(false)
    if (err) setError(err)
    else setUrl('')
  }

  return (
    <div>
      <div className="flex gap-1.5">
        <input
          className="input flex-1"
          placeholder="Paste a metrodreamin.com map link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
        <button className="btn" disabled={busy} onClick={() => void submit()}>
          {busy ? '…' : 'Import'}
        </button>
      </div>
      {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
    </div>
  )
}
