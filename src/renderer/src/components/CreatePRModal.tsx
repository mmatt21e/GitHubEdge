import { useState } from 'react'

interface Props {
  headBranch: string
  onClose: () => void
  onCreate: (params: { title: string; base: string; body?: string; draft: boolean }) => Promise<void>
}

export function CreatePRModal({ headBranch, onClose, onCreate }: Props): JSX.Element {
  const [title, setTitle] = useState('')
  const [base, setBase] = useState('main')
  const [body, setBody] = useState('')
  const [draft, setDraft] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(): Promise<void> {
    if (!title.trim() || !base.trim()) return
    setBusy(true)
    try {
      await onCreate({ title: title.trim(), base: base.trim(), body: body.trim() || undefined, draft })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create pull request</h2>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="muted">
            Merging <strong>{headBranch}</strong> into the base branch below. Push your branch
            first if it isn't on GitHub yet.
          </p>
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Base branch</label>
            <input value={base} onChange={(e) => setBase(e.target.value)} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              style={{ width: '100%', minHeight: 120 }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <label className="flex gap" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
            Create as draft
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-accent"
            disabled={busy || !title.trim() || !base.trim()}
            onClick={submit}
          >
            {busy ? <span className="spinner" /> : 'Create pull request'}
          </button>
        </div>
      </div>
    </div>
  )
}
