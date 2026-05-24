import { useState } from 'react'

interface Props {
  canPublish: boolean
  onClose: () => void
  onCreate: (params: {
    parentDir: string
    name: string
    withReadme: boolean
    publish: boolean
    private: boolean
    description?: string
  }) => Promise<void>
}

export function NewRepoModal({ canPublish, onClose, onCreate }: Props): JSX.Element {
  const [name, setName] = useState('')
  const [parentDir, setParentDir] = useState('')
  const [withReadme, setWithReadme] = useState(true)
  const [publish, setPublish] = useState(false)
  const [isPrivate, setIsPrivate] = useState(true)
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const sep = parentDir.includes('\\') ? '\\' : '/'
  const validName = /^[A-Za-z0-9._-]+$/.test(name)

  async function pickDir(): Promise<void> {
    const dir = await window.api.dialog.openDirectory()
    if (dir) setParentDir(dir)
  }

  async function submit(): Promise<void> {
    if (!validName || !parentDir) return
    setBusy(true)
    try {
      await onCreate({
        parentDir,
        name: name.trim(),
        withReadme,
        publish: publish && canPublish,
        private: isPrivate,
        description: description.trim() || undefined
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create a new repository</h2>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              autoFocus
            />
            {name && !validName && (
              <span className="hint" style={{ color: 'var(--red)' }}>
                Use only letters, numbers, dots, hyphens, and underscores.
              </span>
            )}
          </div>
          <div className="field">
            <label>Local parent folder</label>
            <div className="flex gap">
              <input style={{ flex: 1 }} value={parentDir} readOnly placeholder="Choose a folder…" />
              <button className="btn" onClick={pickDir}>
                Browse…
              </button>
            </div>
            {parentDir && validName && (
              <span className="hint">
                Creates: {parentDir}
                {sep}
                {name}
              </span>
            )}
          </div>
          <label className="flex gap" style={{ alignItems: 'center', marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={withReadme}
              onChange={(e) => setWithReadme(e.target.checked)}
            />
            Initialize with a README and .gitignore
          </label>

          <label className="flex gap" style={{ alignItems: 'center', marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={publish && canPublish}
              disabled={!canPublish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            Publish to GitHub {!canPublish && <span className="muted">(sign in first)</span>}
          </label>

          {publish && canPublish && (
            <div style={{ paddingLeft: 24 }}>
              <label className="flex gap" style={{ alignItems: 'center', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                Private repository
              </label>
              <div className="field">
                <label>Description (optional)</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-accent"
            disabled={busy || !validName || !parentDir}
            onClick={submit}
          >
            {busy ? <span className="spinner" /> : 'Create repository'}
          </button>
        </div>
      </div>
    </div>
  )
}
