import { useState } from 'react'
import type { Branch, GitHubAccount, Repo, RepoStatus } from '@shared/types'

interface Props {
  currentRepo: Repo | null
  repos: Repo[]
  status: RepoStatus | null
  branches: Branch[]
  syncing: boolean
  account: GitHubAccount | null
  isGitHubRepo: boolean
  notify: (message: string, error?: boolean) => void
  onSelectRepo: (repo: Repo) => void
  onAddLocal: () => void
  onCreateRepo: () => void
  onClone: () => void
  onCloneFromGitHub: () => void
  onRemoveRepo: (repo: Repo) => void
  onCheckout: (name: string) => void
  onCreateBranch: (name: string) => void
  onDeleteBranch: (name: string) => void
  onRenameBranch: (oldName: string, newName: string) => void
  onMerge: (name: string) => void
  onSync: () => void
  onOpenAccount: () => void
  onOpenSettings: () => void
}

export function Toolbar(props: Props): JSX.Element {
  const [openMenu, setOpenMenu] = useState<'repo' | 'branch' | null>(null)
  const [newBranch, setNewBranch] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [repoFilter, setRepoFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const { status } = props

  const filteredRepos = props.repos.filter(
    (r) =>
      r.name.toLowerCase().includes(repoFilter.toLowerCase()) ||
      r.path.toLowerCase().includes(repoFilter.toLowerCase())
  )
  const filteredBranches = props.branches.filter((b) =>
    b.name.toLowerCase().includes(branchFilter.toLowerCase())
  )

  function syncLabel(): { main: string; sub: string } {
    if (!status) return { main: 'Fetch', sub: 'origin' }
    if (status.behind > 0) return { main: 'Pull origin', sub: `↓ ${status.behind}` }
    if (status.ahead > 0) return { main: 'Push origin', sub: `↑ ${status.ahead}` }
    return { main: 'Fetch origin', sub: status.upstream ?? 'no upstream' }
  }
  const sync = syncLabel()

  async function viewOnGitHub(): Promise<void> {
    if (!props.currentRepo) return
    const res = await window.api.github.webUrl(props.currentRepo.path)
    if (res.ok && res.data) window.api.shell.openExternal(res.data)
    else props.notify('Could not determine the GitHub URL for this repository.', true)
  }

  async function openTerminal(): Promise<void> {
    if (!props.currentRepo) return
    const res = await window.api.shell.openTerminal(props.currentRepo.path)
    if (!res.ok) props.notify(res.error!, true)
  }

  function close(): void {
    setOpenMenu(null)
    setNewBranch('')
    setRenaming(null)
    setRenameValue('')
    setRepoFilter('')
    setBranchFilter('')
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
            {props.repos.length > 6 && (
              <div style={{ padding: 8 }}>
                <input
                  style={{ width: '100%' }}
                  placeholder="Filter repositories…"
                  value={repoFilter}
                  autoFocus
                  onChange={(e) => setRepoFilter(e.target.value)}
                />
              </div>
            )}
            <div className="dropdown-section">Repositories</div>
            {props.repos.length === 0 && (
              <div className="dropdown-item muted">None added yet</div>
            )}
            {filteredRepos.map((repo) => (
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
                props.onCreateRepo()
                close()
              }}
            >
              ✚ Create new repository…
            </div>
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
            {props.currentRepo && (
              <>
                <div className="dropdown-section">{props.currentRepo.name}</div>
                <div
                  className="dropdown-item"
                  onClick={() => {
                    window.api.shell.openPath(props.currentRepo!.path)
                    close()
                  }}
                >
                  🗂 Open in file explorer
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => {
                    openTerminal()
                    close()
                  }}
                >
                  ⌨ Open in terminal
                </div>
                {props.isGitHubRepo && (
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      viewOnGitHub()
                      close()
                    }}
                  >
                    ↗ View on GitHub
                  </div>
                )}
                <div
                  className="dropdown-item"
                  onClick={() => {
                    window.api.clipboard.write(props.currentRepo!.path)
                    props.notify('Path copied to clipboard.')
                    close()
                  }}
                >
                  ⧉ Copy repository path
                </div>
              </>
            )}
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
            {props.branches.length > 6 && (
              <div style={{ padding: 8 }}>
                <input
                  style={{ width: '100%' }}
                  placeholder="Filter branches…"
                  value={branchFilter}
                  autoFocus
                  onChange={(e) => setBranchFilter(e.target.value)}
                />
              </div>
            )}
            <div className="dropdown-section">Branches</div>
            {filteredBranches.map((b) =>
              renaming === b.name ? (
                <div key={b.name} className="dropdown-item" onClick={(e) => e.stopPropagation()}>
                  <input
                    style={{ flex: 1 }}
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && renameValue.trim() && renameValue.trim() !== b.name) {
                        props.onRenameBranch(b.name, renameValue.trim())
                        close()
                      } else if (e.key === 'Escape') {
                        setRenaming(null)
                      }
                    }}
                  />
                  <button
                    className="btn-accent"
                    disabled={!renameValue.trim() || renameValue.trim() === b.name}
                    onClick={() => {
                      props.onRenameBranch(b.name, renameValue.trim())
                      close()
                    }}
                  >
                    Rename
                  </button>
                </div>
              ) : (
                <div
                  key={b.name}
                  className={`dropdown-item ${b.current ? 'active' : ''}`}
                  onClick={() => {
                    if (!b.current) props.onCheckout(b.name)
                    close()
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{b.name}</span>
                  <span className="flex" style={{ gap: 2 }} onClick={(e) => e.stopPropagation()}>
                    {!b.current && (
                      <button
                        className="btn-ghost"
                        title={`Merge ${b.name} into ${status?.branch}`}
                        onClick={() => {
                          props.onMerge(b.name)
                          close()
                        }}
                      >
                        Merge
                      </button>
                    )}
                    <button
                      className="btn-ghost"
                      title="Rename branch"
                      onClick={() => {
                        setRenaming(b.name)
                        setRenameValue(b.name)
                      }}
                    >
                      ✎
                    </button>
                    {!b.current && (
                      <button
                        className="btn-ghost"
                        title="Delete branch"
                        onClick={() => {
                          props.onDeleteBranch(b.name)
                          close()
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </div>
              )
            )}
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
