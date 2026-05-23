import { useState } from 'react'

interface Props {
  onClose: () => void
  onClone: (url: string, parentDir: string) => Promise<void>
}

function repoNameFromUrl(url: string): string {
  const m = url.trim().replace(/\.git$/, '').match(/([^/:]+)\/?$/)
  return m ? m[1] : ''
}

export function CloneModal({ onClose, onClone }: Props): JSX.Element {
  const [url, setUrl] = useState('')
  const [parentDir, setParentDir] = useState('')
  const [busy, setBusy] = useState(false)
  const targetName = repoNameFromUrl(url)

  async function pickDir(): Promise<void> {
    const dir = await window.api.dialog.openDirectory()
    if (dir) setParentDir(dir)
  }

  async function submit(): Promise<void> {
    if (!url.trim() || !parentDir) return
    setBusy(true)
    try {
      await onClone(url.trim(), parentDir)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Clone a repository</h2>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Repository URL</label>
            <input
              placeholder="https://github.com/user/repo.git"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label>Local parent folder</label>
            <div className="flex gap">
              <input style={{ flex: 1 }} value={parentDir} readOnly placeholder="Choose a folder…" />
              <button className="btn" onClick={pickDir}>
                Browse…
              </button>
            </div>
            {parentDir && targetName && (
              <span className="hint">
                Will clone into: {parentDir}
                {parentDir.includes('\\') ? '\\' : '/'}
                {targetName}
              </span>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-accent"
            disabled={!url.trim() || !parentDir || busy}
            onClick={submit}
          >
            {busy ? <span className="spinner" /> : 'Clone'}
          </button>
        </div>
      </div>
    </div>
  )
}
