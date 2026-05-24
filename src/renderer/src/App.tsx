import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AppSettings,
  Branch,
  Commit,
  CommitFile,
  FileChange,
  GitHubAccount,
  GitHubRepo,
  PullRequest,
  Repo,
  RepoStatus,
  Stash
} from '@shared/types'
import { unwrap } from './util'
import { Toolbar } from './components/Toolbar'
import { ChangesView } from './components/ChangesView'
import { HistoryView } from './components/HistoryView'
import { DiffView } from './components/DiffView'
import { CommitDetail } from './components/CommitDetail'
import { SettingsModal } from './components/SettingsModal'
import { CloneModal } from './components/CloneModal'
import { AccountModal } from './components/AccountModal'
import { RepoBrowserModal } from './components/RepoBrowserModal'
import { PullRequestsView } from './components/PullRequestsView'
import { PullRequestDetail } from './components/PullRequestDetail'
import { CreatePRModal } from './components/CreatePRModal'
import { ConflictEditor } from './components/ConflictEditor'
import { NewRepoModal } from './components/NewRepoModal'

type Tab = 'changes' | 'history' | 'pulls'

const EMPTY_SETTINGS: AppSettings = { repos: [], providers: [] }

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(EMPTY_SETTINGS)
  const [currentRepo, setCurrentRepo] = useState<Repo | null>(null)
  const [status, setStatus] = useState<RepoStatus | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [stashes, setStashes] = useState<Stash[]>([])
  const [tab, setTab] = useState<Tab>('changes')

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  // History view state.
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null)
  const [commitFiles, setCommitFiles] = useState<CommitFile[]>([])
  const [commitFilePath, setCommitFilePath] = useState<string | null>(null)
  const [commitDiff, setCommitDiff] = useState<string | null>(null)
  const [commitDiffLoading, setCommitDiffLoading] = useState(false)

  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')

  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [merging, setMerging] = useState(false)
  const [amendMode, setAmendMode] = useState(false)

  // GitHub state.
  const [account, setAccount] = useState<GitHubAccount | null>(null)
  const [isGitHubRepo, setIsGitHubRepo] = useState(false)
  const [pulls, setPulls] = useState<PullRequest[]>([])
  const [pullsLoading, setPullsLoading] = useState(false)
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null)

  const [showSettings, setShowSettings] = useState(false)
  const [showClone, setShowClone] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showRepoBrowser, setShowRepoBrowser] = useState(false)
  const [showCreatePR, setShowCreatePR] = useState(false)
  const [conflictFile, setConflictFile] = useState<FileChange | null>(null)
  const [showNewRepo, setShowNewRepo] = useState(false)
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = useCallback((message: string, error = false): void => {
    setToast({ message, error })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), error ? 6000 : 3500)
  }, [])

  // Apply the selected theme to the document.
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme ?? 'system'
  }, [settings.theme])

  // Initial load.
  useEffect(() => {
    window.api.settings.get().then((s) => {
      setSettings(s)
      setAccount(s.github?.account ?? null)
      if (s.repos.length > 0) setCurrentRepo(s.repos[0])
    })
  }, [])

  const refresh = useCallback(
    async (repo: Repo): Promise<void> => {
      try {
        const [s, b, l, st, m, remote] = await Promise.all([
          window.api.git.status(repo.path),
          window.api.git.branches(repo.path),
          window.api.git.log(repo.path, 100),
          window.api.git.stashList(repo.path),
          window.api.git.isMerging(repo.path),
          window.api.git.remoteUrl(repo.path)
        ])
        setStatus(unwrap(s))
        setBranches(unwrap(b))
        setCommits(unwrap(l))
        setStashes(unwrap(st))
        setMerging(unwrap(m))
        setIsGitHubRepo(!!(remote.ok && remote.data && remote.data.includes('github.com')))
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
    setSelectedCommit(null)
    setCommitFiles([])
    setCommitFilePath(null)
    setCommitDiff(null)
    setDiff(null)
    setSelectedPR(null)
    setPulls([])
    setAmendMode(false)
    refresh(currentRepo)
  }, [currentRepo, refresh])

  const loadPulls = useCallback(async (): Promise<void> => {
    if (!currentRepo) return
    setPullsLoading(true)
    const res = await window.api.github.pulls(currentRepo.path)
    setPullsLoading(false)
    if (!res.ok) return notify(res.error!, true)
    setPulls(res.data!)
  }, [currentRepo, notify])

  // Load pull requests when the PR tab is opened for a signed-in GitHub repo.
  useEffect(() => {
    if (tab === 'pulls' && account && isGitHubRepo && currentRepo) {
      loadPulls()
    }
  }, [tab, account, isGitHubRepo, currentRepo, loadPulls])

  const reloadSettings = useCallback(async (): Promise<AppSettings> => {
    const s = await window.api.settings.get()
    setSettings(s)
    return s
  }, [])

  async function selectFile(file: FileChange): Promise<void> {
    if (!currentRepo) return
    setSelectedPath(file.path)
    setDiffLoading(true)
    if (file.status === 'conflicted') {
      // Show the raw working file so conflict markers are visible.
      const res = await window.api.git.fileContent(currentRepo.path, file.path)
      setDiffLoading(false)
      setDiff(res.ok ? res.data ?? '' : `Error: ${res.error}`)
      return
    }
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

  async function loadCommitFileDiff(commit: Commit, file: CommitFile): Promise<void> {
    if (!currentRepo) return
    setCommitFilePath(file.path)
    setCommitDiffLoading(true)
    const res = await window.api.git.commitDiff(currentRepo.path, commit.hash, file.path)
    setCommitDiffLoading(false)
    setCommitDiff(res.ok ? res.data ?? '' : `Error: ${res.error}`)
  }

  async function selectCommit(commit: Commit): Promise<void> {
    if (!currentRepo) return
    setSelectedCommit(commit)
    setCommitFilePath(null)
    setCommitDiff(null)
    setCommitFiles([])
    const res = await window.api.git.commitFiles(currentRepo.path, commit.hash)
    if (!res.ok) return notify(res.error!, true)
    const files = res.data ?? []
    setCommitFiles(files)
    if (files.length > 0) loadCommitFileDiff(commit, files[0])
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

  async function discardAll(): Promise<void> {
    if (!currentRepo || !status || status.files.length === 0) return
    if (
      !confirm(
        `Discard all changes to ${status.files.length} file(s)? This cannot be undone.`
      )
    )
      return
    const res = await window.api.git.discard(
      currentRepo.path,
      status.files.map((f) => f.path)
    )
    if (!res.ok) return notify(res.error!, true)
    setSelectedPath(null)
    setDiff(null)
    notify('Discarded all changes.')
    await refresh(currentRepo)
  }

  async function doCommit(): Promise<void> {
    if (!currentRepo) return
    const message = description.trim()
      ? `${summary.trim()}\n\n${description.trim()}`
      : summary.trim()
    setBusy(true)
    const res = merging
      ? await window.api.git.mergeContinue(currentRepo.path, message || undefined)
      : amendMode
        ? await window.api.git.amend(currentRepo.path, message)
        : await window.api.git.commit(currentRepo.path, message)
    setBusy(false)
    if (!res.ok) return notify(res.error!, true)
    setSummary('')
    setDescription('')
    setAmendMode(false)
    setSelectedPath(null)
    setDiff(null)
    notify(merging ? 'Merge committed.' : amendMode ? 'Commit amended.' : 'Commit created.')
    await refresh(currentRepo)
  }

  async function toggleAmend(on: boolean): Promise<void> {
    setAmendMode(on)
    if (on && currentRepo) {
      const res = await window.api.git.lastMessage(currentRepo.path)
      if (res.ok) {
        const [first, ...rest] = (res.data ?? '').split('\n')
        setSummary(first ?? '')
        setDescription(rest.join('\n').trim())
      }
    } else {
      setSummary('')
      setDescription('')
    }
  }

  async function undoLastCommit(): Promise<void> {
    if (!currentRepo) return
    const res = await window.api.git.undoLast(currentRepo.path)
    if (!res.ok) return notify(res.error!, true)
    notify('Undid last commit — its changes are staged.')
    await refresh(currentRepo)
  }

  // ---- Merge & conflicts ----
  async function mergeBranch(name: string): Promise<void> {
    if (!currentRepo) return
    const res = await window.api.git.merge(currentRepo.path, name)
    if (!res.ok) return notify(res.error!, true)
    await refresh(currentRepo)
    if (res.data!.conflicted) {
      setTab('changes')
      setSelectedPath(null)
      setDiff(null)
      notify(`Merge has ${res.data!.conflicts.length} conflict(s). Resolve them, then commit.`, true)
    } else {
      notify(`Merged ${name}.`)
    }
  }

  async function abortMerge(): Promise<void> {
    if (!currentRepo) return
    const res = await window.api.git.mergeAbort(currentRepo.path)
    if (!res.ok) return notify(res.error!, true)
    setSelectedPath(null)
    setDiff(null)
    notify('Merge aborted.')
    await refresh(currentRepo)
  }

  async function resolveConflict(file: FileChange, side: 'ours' | 'theirs'): Promise<void> {
    if (!currentRepo) return
    const res = await window.api.git.resolve(currentRepo.path, file.path, side)
    if (!res.ok) return notify(res.error!, true)
    if (selectedPath === file.path) {
      setSelectedPath(null)
      setDiff(null)
    }
    await refresh(currentRepo)
  }

  async function onConflictResolved(): Promise<void> {
    if (!currentRepo) return
    setConflictFile(null)
    setSelectedPath(null)
    setDiff(null)
    await refresh(currentRepo)
  }

  // ---- GitHub ----
  function onSignedIn(acc: GitHubAccount): void {
    setAccount(acc)
    reloadSettings()
    setShowAccount(false)
  }

  function onSignedOut(): void {
    setAccount(null)
    setPulls([])
    reloadSettings()
  }

  async function cloneFromGitHub(repo: GitHubRepo): Promise<void> {
    const parentDir = await window.api.dialog.openDirectory()
    if (!parentDir) return
    const sep = parentDir.includes('\\') ? '\\' : '/'
    const target = `${parentDir.replace(/[\\/]+$/, '')}${sep}${repo.name}`
    const res = await window.api.git.clone(repo.cloneUrl, target)
    if (!res.ok) {
      notify(res.error!, true)
      throw new Error(res.error)
    }
    await reloadSettings()
    setCurrentRepo(res.data!)
    setShowRepoBrowser(false)
    notify(`Cloned "${res.data!.name}".`)
  }

  function openRepoBrowser(): void {
    if (!account) {
      setShowAccount(true)
      notify('Sign in to GitHub to browse your repositories.', true)
      return
    }
    setShowRepoBrowser(true)
  }

  async function createPull(params: {
    title: string
    base: string
    body?: string
    draft: boolean
  }): Promise<void> {
    if (!currentRepo) return
    const res = await window.api.github.createPull(currentRepo.path, params)
    if (!res.ok) {
      notify(res.error!, true)
      throw new Error(res.error)
    }
    setShowCreatePR(false)
    notify(`Created PR #${res.data!.number}.`)
    setSelectedPR(res.data!)
    await loadPulls()
  }

  async function checkoutPR(pr: PullRequest): Promise<void> {
    if (!currentRepo) return
    const res = await window.api.github.checkoutPull(currentRepo.path, pr.number)
    if (!res.ok) {
      notify(res.error!, true)
      throw new Error(res.error)
    }
    notify(`Checked out "${res.data}" for PR #${pr.number}.`)
    setTab('changes')
    await refresh(currentRepo)
  }

  async function generateMessage(): Promise<void> {
    if (!currentRepo) return
    setGenerating(true)
    setSummary('')
    setDescription('')
    let acc = ''
    const res = await window.api.llm.generateCommitMessageStream(currentRepo.path, (chunk) => {
      acc += chunk
      const [first, ...rest] = acc.split('\n')
      setSummary(first ?? '')
      setDescription(rest.join('\n').trim())
    })
    setGenerating(false)
    if (!res.ok) {
      setSummary('')
      setDescription('')
      return notify(res.error!, true)
    }
    // Use the cleaned final text (strips stray quotes/whitespace).
    const text = (res.data ?? acc).trim()
    const [first, ...rest] = text.split('\n')
    setSummary(first ?? '')
    setDescription(rest.join('\n').trim())
  }

  async function stashChanges(): Promise<void> {
    if (!currentRepo) return
    const res = await window.api.git.stashSave(currentRepo.path)
    if (!res.ok) return notify(res.error!, true)
    setSelectedPath(null)
    setDiff(null)
    notify('Changes stashed.')
    await refresh(currentRepo)
  }

  async function stashPop(stash: Stash): Promise<void> {
    if (!currentRepo) return
    const res = await window.api.git.stashPop(currentRepo.path, stash.ref)
    if (!res.ok) return notify(res.error!, true)
    notify('Stash applied.')
    await refresh(currentRepo)
  }

  async function stashDrop(stash: Stash): Promise<void> {
    if (!currentRepo) return
    if (!confirm(`Delete stash "${stash.message || stash.ref}"? This cannot be undone.`)) return
    const res = await window.api.git.stashDrop(currentRepo.path, stash.ref)
    if (!res.ok) return notify(res.error!, true)
    notify('Stash deleted.')
    await refresh(currentRepo)
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

  async function createRepo(params: {
    parentDir: string
    name: string
    withReadme: boolean
    publish: boolean
    private: boolean
    description?: string
  }): Promise<void> {
    const res = await window.api.git.create(params)
    if (!res.ok) {
      notify(res.error!, true)
      throw new Error(res.error)
    }
    await reloadSettings()
    setCurrentRepo(res.data!)
    setShowNewRepo(false)
    notify(`Created "${res.data!.name}".`)
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

  async function deleteBranch(name: string): Promise<void> {
    if (!currentRepo) return
    let res = await window.api.git.deleteBranch(currentRepo.path, name)
    if (!res.ok && /not fully merged/i.test(res.error ?? '')) {
      if (!confirm(`Branch "${name}" is not fully merged. Delete it anyway?`)) return
      res = await window.api.git.deleteBranch(currentRepo.path, name, true)
    }
    if (!res.ok) return notify(res.error!, true)
    await refresh(currentRepo)
    notify(`Deleted ${name}.`)
  }

  async function renameBranch(oldName: string, newName: string): Promise<void> {
    if (!currentRepo) return
    const res = await window.api.git.renameBranch(currentRepo.path, oldName, newName)
    if (!res.ok) return notify(res.error!, true)
    await refresh(currentRepo)
    notify(`Renamed ${oldName} → ${newName}.`)
  }

  function saveSettings(draft: AppSettings): void {
    window.api.settings.save(draft).then((saved) => {
      setSettings(saved)
      setShowSettings(false)
      notify('Settings saved.')
    })
  }

  const hasProvider = settings.providers.length > 0
  const anyModalOpen =
    showSettings ||
    showClone ||
    showAccount ||
    showRepoBrowser ||
    showCreatePR ||
    showNewRepo ||
    !!conflictFile

  const stagedCount = status?.files.filter((f) => f.staged).length ?? 0
  const conflictCount = status?.files.filter((f) => f.status === 'conflicted').length ?? 0
  const canCommit =
    !!status &&
    !busy &&
    (merging
      ? conflictCount === 0
      : amendMode
        ? !!summary.trim()
        : stagedCount > 0 && !!summary.trim())

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        if (anyModalOpen) {
          setShowSettings(false)
          setShowClone(false)
          setShowAccount(false)
          setShowRepoBrowser(false)
          setShowCreatePR(false)
          setShowNewRepo(false)
          setConflictFile(null)
        }
        return
      }
      // F5 refreshes (Ctrl+R is left to the platform's reload to avoid clashes).
      if (e.key === 'F5') {
        e.preventDefault()
        if (currentRepo) refresh(currentRepo)
        return
      }
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'Enter') {
        if (tab === 'changes' && canCommit) {
          e.preventDefault()
          doCommit()
        }
      } else if (e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
      } else if (e.key === '1') {
        e.preventDefault()
        setTab('changes')
      } else if (e.key === '2') {
        e.preventDefault()
        setTab('history')
      } else if (e.key === '3') {
        e.preventDefault()
        setTab('pulls')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyModalOpen, tab, canCommit, currentRepo, summary, description, merging, amendMode])

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
        account={account}
        isGitHubRepo={isGitHubRepo}
        notify={notify}
        onSelectRepo={setCurrentRepo}
        onAddLocal={addLocal}
        onCreateRepo={() => setShowNewRepo(true)}
        onClone={() => setShowClone(true)}
        onCloneFromGitHub={openRepoBrowser}
        onRemoveRepo={removeRepo}
        onCheckout={checkout}
        onCreateBranch={createBranch}
        onDeleteBranch={deleteBranch}
        onRenameBranch={renameBranch}
        onMerge={mergeBranch}
        onSync={sync}
        onOpenAccount={() => setShowAccount(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {!currentRepo ? (
        <div className="welcome">
          <h1>Welcome to GitHubEdge</h1>
          <p>A GitHub Desktop-style client with your own AI models built in.</p>
          <div className="actions">
            <button className="btn-accent" onClick={() => setShowNewRepo(true)}>
              Create new repository
            </button>
            <button className="btn" onClick={addLocal}>
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
              <button
                className={`tab ${tab === 'pulls' ? 'active' : ''}`}
                onClick={() => setTab('pulls')}
              >
                Pull Requests
              </button>
            </div>

            {tab === 'changes' && status && (
              <ChangesView
                status={status}
                stashes={stashes}
                selectedPath={selectedPath}
                busy={busy}
                generating={generating}
                hasProvider={hasProvider}
                merging={merging}
                canAmend={commits.length > 0}
                amendMode={amendMode}
                lastCommitSubject={commits[0]?.subject}
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
                onToggleAmend={toggleAmend}
                onUndoLast={undoLastCommit}
                onStash={stashChanges}
                onDiscardAll={discardAll}
                onStashPop={stashPop}
                onStashDrop={stashDrop}
                onAbortMerge={abortMerge}
                onResolve={resolveConflict}
                onEditConflict={setConflictFile}
              />
            )}

            {tab === 'history' && (
              <HistoryView
                commits={commits}
                selectedHash={selectedCommit?.hash ?? null}
                onSelect={selectCommit}
              />
            )}

            {tab === 'pulls' && (
              <PullRequestsView
                signedIn={!!account}
                isGitHubRepo={isGitHubRepo}
                pulls={pulls}
                loading={pullsLoading}
                selectedNumber={selectedPR?.number ?? null}
                onSelect={setSelectedPR}
                onCreate={() => setShowCreatePR(true)}
                onRefresh={loadPulls}
                onSignIn={() => setShowAccount(true)}
              />
            )}
          </div>

          <div className="main-panel">
            {tab === 'changes' && (
              <DiffView
                title={diffTitle}
                filePath={selectedPath ?? undefined}
                diff={diff}
                loading={diffLoading}
              />
            )}
            {tab === 'history' &&
              (selectedCommit ? (
                <CommitDetail
                  commit={selectedCommit}
                  files={commitFiles}
                  selectedPath={commitFilePath}
                  diff={commitDiff}
                  diffLoading={commitDiffLoading}
                  onSelectFile={(f) => loadCommitFileDiff(selectedCommit, f)}
                />
              ) : (
                <div className="placeholder">Select a commit to view its changes.</div>
              ))}
            {tab === 'pulls' &&
              (selectedPR ? (
                <PullRequestDetail
                  pr={selectedPR}
                  repoPath={currentRepo.path}
                  onCheckout={checkoutPR}
                />
              ) : (
                <div className="placeholder">Select a pull request to view details.</div>
              ))}
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

      {showAccount && (
        <AccountModal
          settings={settings}
          onClose={() => setShowAccount(false)}
          onSignedIn={onSignedIn}
          onSignedOut={onSignedOut}
          notify={notify}
        />
      )}

      {showRepoBrowser && (
        <RepoBrowserModal
          onClose={() => setShowRepoBrowser(false)}
          onClone={cloneFromGitHub}
          notify={notify}
        />
      )}

      {showCreatePR && status && (
        <CreatePRModal
          headBranch={status.branch}
          onClose={() => setShowCreatePR(false)}
          onCreate={createPull}
        />
      )}

      {showNewRepo && (
        <NewRepoModal
          canPublish={!!account}
          onClose={() => setShowNewRepo(false)}
          onCreate={createRepo}
        />
      )}

      {conflictFile && currentRepo && (
        <ConflictEditor
          repoPath={currentRepo.path}
          filePath={conflictFile.path}
          onClose={() => setConflictFile(null)}
          onResolved={onConflictResolved}
          notify={notify}
        />
      )}

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.message}</div>}
    </div>
  )
}
