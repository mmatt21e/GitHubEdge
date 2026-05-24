import { useState } from 'react'
import type { Branch, GitHubAccount, Repo, RepoStatus } from '@shared/types'

interface Props {
  currentRepo: Repo | null
  repos: Repo[]
  status: RepoStatus | null
  branches: Branch[]
  syncing: boolean
  account: GitHubAccount | null
  onSelectRepo: (repo: Repo) => void
  onAddLocal: () => void
  onClone: () => void
  onCloneFromGitHub: () => void
  onRemoveRepo: (repo: Repo) => void
  onCheckout: (name: string) => void
  onCreateBranch: (name: string) => void
  onMerge: (name: string) => void
  onSync: () => void
  onOpenAccount: () => void
  onOpenSettings: () => void
}

export function Toolbar(props: Props): JSX.Element {
  const [openMenu, setOpenMenu] = useState<'repo' | 'branch' | null>(null)
  const [newBranch, setNewBranch] = useState('')
  const { status } = props

  function syncLabel(): { main: string; sub: string } {
    if (!status) return { main: 'Fetch', sub: 'origin' }
    if (status.behind > 0) return { main: 'Pull origin', sub: `↓ ${status.behind}` }
    if (status.ahead > 0) return { main: 'Push origin', sub: `↑ ${status.ahead}` }
    return { main: 'Fetch origin', sub: status.upstream ?? 'no upstream' }
  }
  const sync = syncLabel()

  function close(): void {
    setOpenMenu(null)
    setNewBranch('')
  }

  return (
    <div className="toolbar" onMouseLeave={() => openMenu && close()}>
      {/* Repository selector */}
      <div
        className="toolbar-item"
        style={{ position: 'relative' }}
        onClick={() => setOpenMenu(openMenu === 'repo' ? null : 'repo')}
      >
        <span className="label">Current repository</span>
        <span className="value">{props.currentRepo?.name ?? 'No repository'} ▾</span>
        {openMenu === 'repo' && (
          <div className="dropdown" style={{ left: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="dropdown-section">Repositories</div>
            {props.repos.length === 0 && (
              <div className="dropdown-item muted">None added yet</div>
            )}
            {props.repos.map((repo) => (
              <div
                key={repo.path}
                className={`dropdown-item ${
                  repo.path === props.currentRepo?.path ? 'active' : ''
                }`}
                onClick={() => {
                  props.onSelectRepo(repo)
                  close()
                }}
              >
                <span>
                  <strong>{repo.name}</strong>
                  <br />
                  <span className="muted" style={{ fontSize: 11 }}>
                    {repo.path}
                  </span>
                </span>
                <button
                  className="btn-ghost"
                  title="Remove from list"
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onRemoveRepo(repo)
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="dropdown-section">Add</div>
            <div
              className="dropdown-item"
              onClick={() => {
                props.onAddLocal()
                close()
              }}
            >
              📁 Add local repository…
            </div>
            <div
              className="dropdown-item"
              onClick={() => {
                props.onClone()
                close()
              }}
            >
              ⬇ Clone repository…
            </div>
            <div
              className="dropdown-item"
              onClick={() => {
                props.onCloneFromGitHub()
                close()
              }}
            >
              ⬇ Clone from GitHub…
            </div>
          </div>
        )}
      </div>

      {/* Branch selector */}
      <div
        className="toolbar-item"
        style={{ position: 'relative' }}
        onClick={() =>
          props.currentRepo && setOpenMenu(openMenu === 'branch' ? null : 'branch')
        }
      >
        <span className="label">Current branch</span>
        <span className="value">{status?.branch ?? '—'} ▾</span>
        {openMenu === 'branch' && (
          <div className="dropdown" onClick={(e) => e.stopPropagation()}>
            <div className="dropdown-section">Branches</div>
            {props.branches.map((b) => (
              <div
                key={b.name}
                className={`dropdown-item ${b.current ? 'active' : ''}`}
                onClick={() => {
                  if (!b.current) props.onCheckout(b.name)
                  close()
                }}
              >
                <span>{b.name}</span>
                {b.current ? (
                  <span className="muted">current</span>
                ) : (
                  <button
                    className="btn-ghost"
                    title={`Merge ${b.name} into ${status?.branch}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onMerge(b.name)
                      close()
                    }}
                  >
                    Merge
                  </button>
                )}
              </div>
            ))}
            <div className="dropdown-section">New branch</div>
            <div className="dropdown-item" onClick={(e) => e.stopPropagation()}>
              <input
                style={{ flex: 1 }}
                placeholder="new-branch-name"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newBranch.trim()) {
                    props.onCreateBranch(newBranch.trim())
                    close()
                  }
                }}
              />
              <button
                className="btn-accent"
                disabled={!newBranch.trim()}
                onClick={() => {
                  props.onCreateBranch(newBranch.trim())
                  close()
                }}
              >
                Create
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="toolbar-spacer" />

      <button
        className="toolbar-action"
        disabled={!props.currentRepo || props.syncing}
        onClick={props.onSync}
        title="Fetch, then push or pull as needed"
      >
        <span>{props.syncing ? '…' : sync.main}</span>
        <span className="sub">{sync.sub}</span>
      </button>

      <button className="toolbar-action" onClick={props.onOpenAccount} title="GitHub account">
        {props.account?.avatarUrl ? (
          <img
            src={props.account.avatarUrl}
            width={20}
            height={20}
            style={{ borderRadius: '50%' }}
            alt=""
          />
        ) : (
          <span>◔</span>
        )}
        <span className="sub">{props.account ? props.account.login : 'Sign in'}</span>
      </button>

      <button className="toolbar-action" onClick={props.onOpenSettings} title="Settings">
        <span>⚙</span>
        <span className="sub">Settings</span>
      </button>
    </div>
  )
}
