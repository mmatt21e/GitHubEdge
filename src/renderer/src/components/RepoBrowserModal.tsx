import { useEffect, useState } from 'react'
import type { GitHubRepo } from '@shared/types'
import { relativeTime } from '../util'

interface Props {
  onClose: () => void
  onClone: (repo: GitHubRepo) => Promise<void>
  notify: (message: string, error?: boolean) => void
}

export function RepoBrowserModal({ onClose, onClone, notify }: Props): JSX.Element {
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null)
  const [filter, setFilter] = useState('')
  const [cloning, setCloning] = useState<string | null>(null)

  useEffect(() => {
    window.api.github.repos().then((res) => {
      if (res.ok) setRepos(res.data!)
      else {
        notify(res.error!, true)
        setRepos([])
      }
    })
  }, [notify])

  const visible = (repos ?? []).filter((r) =>
    r.fullName.toLowerCase().includes(filter.toLowerCase())
  )

  async function clone(repo: GitHubRepo): Promise<void> {
    setCloning(repo.fullName)
    try {
      await onClone(repo)
    } finally {
      setCloning(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Your GitHub repositories</h2>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ paddingTop: 12 }}>
          <input
            style={{ width: '100%', marginBottom: 12 }}
            placeholder="Filter repositories…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
          {repos === null && (
            <div className="placeholder">
              <span className="spinner" /> &nbsp;Loading repositories…
            </div>
          )}
          {repos !== null && visible.length === 0 && (
            <div className="placeholder">No repositories found.</div>
          )}
          {visible.map((r) => (
            <div key={r.fullName} className="provider-card" style={{ marginBottom: 8 }}>
              <div className="flex gap" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {r.fullName} {r.private && <span className="muted">· private</span>}
                  </div>
                  {r.description && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {r.description}
                    </div>
                  )}
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {r.defaultBranch} · updated {relativeTime(Date.parse(r.updatedAt) / 1000)}
                  </div>
                </div>
                <button
                  className="btn-accent"
                  disabled={cloning !== null}
                  onClick={() => clone(r)}
                >
                  {cloning === r.fullName ? <span className="spinner" /> : 'Clone'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
