import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AppSettings,
  Branch,
  Commit,
  FileChange,
  Repo,
  RepoStatus
} from '@shared/types'
import { unwrap } from './util'
import { Toolbar } from './components/Toolbar'
import { ChangesView } from './components/ChangesView'
import { HistoryView } from './components/HistoryView'
import { DiffView } from './components/DiffView'
import { SettingsModal } from './components/SettingsModal'
import { CloneModal } from './components/CloneModal'

type Tab = 'changes' | 'history'

const EMPTY_SETTINGS: AppSettings = { repos: [], providers: [] }

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(EMPTY_SETTINGS)
  const [currentRepo, setCurrentRepo] = useState<Repo | null>(null)
  const [status, setStatus] = useState<RepoStatus | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [tab, setTab] = useState<Tab>('changes')

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedHash, setSelectedHash] = useState<string | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')

  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [showSettings, setShowSettings] = useState(false)
  const [showClone, setShowClone] = useState(false)
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = useCallback((message: string, error = false): void => {
    setToast({ message, error })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), error ? 6000 : 3500)
  }, [])

  // Initial load.
  useEffect(() => {
    window.api.settings.get().then((s) => {
      setSettings(s)
      if (s.repos.length > 0) setCurrentRepo(s.repos[0])
    })
  }, [])

  const refresh = useCallback(
    async (repo: Repo): Promise<void> => {
      try {
        const [s, b, l] = await Promise.all([
          window.api.git.status(repo.path),
          window.api.git.branches(repo.path),
          window.api.git.log(repo.path, 100)
        ])
        setStatus(unwrap(s))
        setBranches(unwrap(b))
        setCommits(unwrap(l))
      } catch (err) {
        notify(err instanceof Error ? err.message : String(err), true)
      }
    },
    [notify]
  )

  // Refresh when the active repository changes.
  useEffect(() => {
    if (!currentRepo) {
      setStatus(null)
      setBranches([])
      setCommits([])
      return
    }
    setSelectedPath(null)
    setSelectedHash(null)
    setDiff(null)
    refresh(currentRepo)
  }, [currentRepo, refresh])

  const reloadSettings = useCallback(async (): Promise<AppSettings> => {
    const s = await window.api.settings.get()
    setSettings(s)
    return s
  }, [])

  async function selectFile(file: FileChange): Promise<void> {
    if (!currentRepo) return
    setSelectedPath(file.path)
    setSelectedHash(null)
    setDiffLoading(true)
    const showStaged = !file.unstaged
    const res = await window.api.git.diff(
      currentRepo.path,
      file.path,
      showStaged,
      file.status === 'untracked'
    )
    setDiffLoading(false)
    setDiff(res.ok ? res.data ?? '' : `Error: ${res.error}`)
  }

  function selectCommit(commit: Commit): void {
    setSelectedHash(commit.hash)
    setSelectedPath(null)
    setDiff(
      `commit ${commit.hash}\nAuthor: ${commit.author} <${commit.email}>\nDate:   ${new Date(
        commit.date * 1000
      ).toString()}\n\n    ${commit.subject}`
    )
  }

  async function toggleFile(file: FileChange, staged: boolean): Promise<void> {
    if (!currentRepo) return
    const op = staged
      ? window.api.git.stage(currentRepo.path, [file.path])
      : window.api.git.unstage(currentRepo.path, [file.path])
    const res = await op
    if (!res.ok) return notify(res.error!, true)
    await refresh(currentRepo)
  }

  async function toggleAll(staged: boolean): Promise<void> {
    if (!currentRepo || !status) return
    const res = staged
      ? await window.api.git.stageAll(currentRepo.path)
      : await window.api.git.unstage(
          currentRepo.path,
          status.files.map((f) => f.path)
        )
    if (!res.ok) return notify(res.error!, true)
    await refresh(currentRepo)
  }

  async function discard(file: FileChange): Promise<void> {
    if (!currentRepo) return
    if (!confirm(`Discard changes to "${file.path}"? This cannot be undone.`)) return
    const res = await window.api.git.discard(currentRepo.path, [file.path])
    if (!res.ok) return notify(res.error!, true)
    if (selectedPath === file.path) {
      setSelectedPath(null)
      setDiff(null)
    }
    await refresh(currentRepo)
  }

  async function doCommit(): Promise<void> {
    if (!currentRepo) return
    const message = description.trim()
      ? `${summary.trim()}\n\n${description.trim()}`
      : summary.trim()
    setBusy(true)
    const res = await window.api.git.commit(currentRepo.path, message)
    setBusy(false)
    if (!res.ok) return notify(res.error!, true)
    setSummary('')
    setDescription('')
    setSelectedPath(null)
    setDiff(null)
    notify('Commit created.')
    await refresh(currentRepo)
  }

  async function generateMessage(): Promise<void> {
    if (!currentRepo) return
    setGenerating(true)
    const res = await window.api.llm.generateCommitMessage(currentRepo.path)
    setGenerating(false)
    if (!res.ok) return notify(res.error!, true)
    const text = (res.data ?? '').trim()
    const [first, ...rest] = text.split('\n')
    setSummary(first ?? '')
    setDescription(rest.join('\n').trim())
    notify('Generated a commit message.')
  }

  async function sync(): Promise<void> {
    if (!currentRepo || !status) return
    setSyncing(true)
    try {
      if (status.behind > 0) {
        unwrap(await window.api.git.pull(currentRepo.path))
        notify('Pulled changes from origin.')
      } else if (status.ahead > 0) {
        unwrap(await window.api.git.push(currentRepo.path))
        notify('Pushed to origin.')
      } else {
        unwrap(await window.api.git.fetch(currentRepo.path))
        notify('Fetched from origin.')
      }
      await refresh(currentRepo)
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), true)
    } finally {
      setSyncing(false)
    }
  }

  async function addLocal(): Promise<void> {
    const dir = await window.api.dialog.openDirectory()
    if (!dir) return
    const res = await window.api.git.addRepo(dir)
    if (!res.ok) return notify(res.error!, true)
    await reloadSettings()
    setCurrentRepo(res.data!)
    notify(`Added "${res.data!.name}".`)
  }

  async function clone(url: string, parentDir: string): Promise<void> {
    const sep = parentDir.includes('\\') ? '\\' : '/'
    const name = url
      .trim()
      .replace(/\.git$/, '')
      .replace(/\/+$/, '')
      .split(/[/:]/)
      .pop()!
    const target = `${parentDir.replace(/[\\/]+$/, '')}${sep}${name}`
    const res = await window.api.git.clone(url, target)
    if (!res.ok) {
      notify(res.error!, true)
      throw new Error(res.error)
    }
    await reloadSettings()
    setCurrentRepo(res.data!)
    setShowClone(false)
    notify(`Cloned "${res.data!.name}".`)
  }

  async function removeRepo(repo: Repo): Promise<void> {
    const res = await window.api.git.removeRepo(repo.path)
    if (!res.ok) return notify(res.error!, true)
    const updated = await reloadSettings()
    if (currentRepo?.path === repo.path) {
      setCurrentRepo(updated.repos[0] ?? null)
    }
  }

  async function checkout(name: string): Promise<void> {
    if (!currentRepo) return
    const res = await window.api.git.checkout(currentRepo.path, name)
    if (!res.ok) return notify(res.error!, true)
    await refresh(currentRepo)
    notify(`Switched to ${name}.`)
  }

  async function createBranch(name: string): Promise<void> {
    if (!currentRepo) return
    const res = await window.api.git.createBranch(currentRepo.path, name)
    if (!res.ok) return notify(res.error!, true)
    await refresh(currentRepo)
    notify(`Created and switched to ${name}.`)
  }

  function saveSettings(draft: AppSettings): void {
    window.api.settings.save(draft).then((saved) => {
      setSettings(saved)
      setShowSettings(false)
      notify('Settings saved.')
    })
  }

  const hasProvider = settings.providers.length > 0
  const selectedFile = status?.files.find((f) => f.path === selectedPath) ?? null
  const diffTitle = selectedFile
    ? `${selectedFile.path}${selectedFile.unstaged ? '' : ' (staged)'}`
    : undefined

  return (
    <div className="app">
      <Toolbar
        currentRepo={currentRepo}
        repos={settings.repos}
        status={status}
        branches={branches}
        syncing={syncing}
        onSelectRepo={setCurrentRepo}
        onAddLocal={addLocal}
        onClone={() => setShowClone(true)}
        onRemoveRepo={removeRepo}
        onCheckout={checkout}
        onCreateBranch={createBranch}
        onSync={sync}
        onOpenSettings={() => setShowSettings(true)}
      />

      {!currentRepo ? (
        <div className="welcome">
          <h1>Welcome to GitHubEdge</h1>
          <p>A GitHub Desktop-style client with your own AI models built in.</p>
          <div className="actions">
            <button className="btn-accent" onClick={addLocal}>
              Add local repository
            </button>
            <button className="btn" onClick={() => setShowClone(true)}>
              Clone repository
            </button>
            <button className="btn" onClick={() => setShowSettings(true)}>
              Configure AI models
            </button>
          </div>
          {!hasProvider && (
            <p className="muted">
              Tip: add a local Ollama model or an API key in Settings to enable AI commit messages.
            </p>
          )}
        </div>
      ) : (
        <div className="body">
          <div className="sidebar">
            <div className="tabs">
              <button
                className={`tab ${tab === 'changes' ? 'active' : ''}`}
                onClick={() => setTab('changes')}
              >
                Changes {status && status.files.length > 0 ? `(${status.files.length})` : ''}
              </button>
              <button
                className={`tab ${tab === 'history' ? 'active' : ''}`}
                onClick={() => setTab('history')}
              >
                History
              </button>
            </div>

            {tab === 'changes' && status && (
              <ChangesView
                status={status}
                selectedPath={selectedPath}
                busy={busy}
                generating={generating}
                hasProvider={hasProvider}
                summary={summary}
                description={description}
                onSummaryChange={setSummary}
                onDescriptionChange={setDescription}
                onSelectFile={selectFile}
                onToggleFile={toggleFile}
                onToggleAll={toggleAll}
                onDiscard={discard}
                onCommit={doCommit}
                onGenerate={generateMessage}
              />
            )}

            {tab === 'history' && (
              <HistoryView
                commits={commits}
                selectedHash={selectedHash}
                onSelect={selectCommit}
              />
            )}
          </div>

          <div className="main-panel">
            <DiffView title={diffTitle} diff={diff} loading={diffLoading} />
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
          notify={notify}
        />
      )}

      {showClone && <CloneModal onClose={() => setShowClone(false)} onClone={clone} />}

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.message}</div>}
    </div>
  )
}
