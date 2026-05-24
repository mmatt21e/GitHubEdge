import { execFile } from 'child_process'
import { promisify } from 'util'
import { basename, dirname } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import type {
  Branch,
  Commit,
  CommitFile,
  FileChange,
  FileChangeStatus,
  MergeResult,
  RepoStatus,
  Stash
} from '@shared/types'

const execFileAsync = promisify(execFile)

const MAX_BUFFER = 1024 * 1024 * 100 // 100 MB for large diffs/logs

/** GitHub token used to authenticate HTTPS network operations. */
let authToken: string | undefined

export function setAuthToken(token: string | undefined): void {
  authToken = token && token.trim() ? token.trim() : undefined
}

// Inline credential helper that feeds the token to git without persisting it.
// The token itself is passed via the GHE_TOKEN env var so it never appears in argv.
const CREDENTIAL_HELPER =
  '!f() { echo username=x-access-token; echo "password=$GHE_TOKEN"; }; f'

/** Run a git command in `cwd` and return stdout. Throws with stderr on failure. */
async function git(
  cwd: string,
  args: string[],
  opts: { authenticated?: boolean } = {}
): Promise<string> {
  let finalArgs = args
  let env = process.env
  if (opts.authenticated && authToken) {
    finalArgs = ['-c', 'credential.helper=', '-c', `credential.helper=${CREDENTIAL_HELPER}`, ...args]
    env = { ...process.env, GHE_TOKEN: authToken }
  }
  try {
    const { stdout } = await execFileAsync('git', finalArgs, {
      cwd,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
      env
    })
    return stdout
  } catch (err) {
    const e = err as { stderr?: string; message?: string; code?: string }
    if (e.code === 'ENOENT') {
      throw new Error(
        'git was not found on your PATH. Install Git and restart GitHubEdge.'
      )
    }
    throw new Error((e.stderr || e.message || 'git command failed').trim())
  }
}

export async function isGitRepo(path: string): Promise<boolean> {
  if (!existsSync(path)) return false
  try {
    const out = await git(path, ['rev-parse', '--is-inside-work-tree'])
    return out.trim() === 'true'
  } catch {
    return false
  }
}

/** Returns the absolute path to the repository root for any path inside it. */
export async function repoRoot(path: string): Promise<string> {
  const out = await git(path, ['rev-parse', '--show-toplevel'])
  return out.trim()
}

function mapStatusCode(x: string, y: string): FileChangeStatus {
  if (x === '?' && y === '?') return 'untracked'
  if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D'))
    return 'conflicted'
  const code = x !== ' ' && x !== '?' ? x : y
  switch (code) {
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    case 'C':
      return 'copied'
    case 'M':
    default:
      return 'modified'
  }
}

export async function getStatus(repoPath: string): Promise<RepoStatus> {
  // -z gives NUL-separated entries; --branch adds the header line.
  const raw = await git(repoPath, [
    'status',
    '--porcelain=v1',
    '--branch',
    '--untracked-files=all',
    '-z'
  ])

  let branch = '(detached)'
  let upstream: string | undefined
  let ahead = 0
  let behind = 0
  const files: FileChange[] = []

  const parts = raw.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]
    if (entry === '') continue

    if (entry.startsWith('## ')) {
      const header = entry.slice(3)
      // Format: branch...upstream [ahead N, behind M]  OR  "No commits yet on main"
      const trackMatch = header.match(/^(.+?)\.\.\.(\S+)/)
      if (trackMatch) {
        branch = trackMatch[1]
        upstream = trackMatch[2]
      } else {
        branch = header.split(' ')[0]
        if (branch === 'No' && header.includes('yet on')) {
          branch = header.split('yet on ')[1]?.trim() || branch
        }
      }
      const aheadMatch = header.match(/ahead (\d+)/)
      const behindMatch = header.match(/behind (\d+)/)
      if (aheadMatch) ahead = parseInt(aheadMatch[1], 10)
      if (behindMatch) behind = parseInt(behindMatch[1], 10)
      continue
    }

    const x = entry[0]
    const y = entry[1]
    let path = entry.slice(3)
    let oldPath: string | undefined

    // Renames/copies store the destination then source as the next NUL field.
    if (x === 'R' || x === 'C') {
      oldPath = parts[i + 1]
      i++
    }

    const staged = x !== ' ' && x !== '?'
    const unstaged = y !== ' '

    files.push({
      path,
      oldPath,
      status: mapStatusCode(x, y),
      staged,
      unstaged
    })
  }

  return {
    branch,
    upstream,
    ahead,
    behind,
    files,
    clean: files.length === 0
  }
}

export async function stageFiles(repoPath: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await git(repoPath, ['add', '--', ...paths])
}

export async function unstageFiles(repoPath: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  // `reset` works even before the first commit when HEAD doesn't exist yet.
  await git(repoPath, ['reset', '--quiet', 'HEAD', '--', ...paths]).catch(async () => {
    await git(repoPath, ['rm', '--cached', '-r', '--', ...paths])
  })
}

export async function stageAll(repoPath: string): Promise<void> {
  await git(repoPath, ['add', '-A'])
}

export async function discardChanges(repoPath: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  // Restore tracked files; remove untracked ones.
  await git(repoPath, ['checkout', '--', ...paths]).catch(() => undefined)
  await git(repoPath, ['clean', '-fd', '--', ...paths]).catch(() => undefined)
}

export async function commit(repoPath: string, message: string): Promise<void> {
  if (!message.trim()) throw new Error('Commit message cannot be empty.')
  await git(repoPath, ['commit', '-m', message])
}

export async function push(repoPath: string): Promise<void> {
  const status = await getStatus(repoPath)
  if (status.upstream) {
    await git(repoPath, ['push'], { authenticated: true })
  } else {
    // No upstream configured: push and set it.
    await git(repoPath, ['push', '--set-upstream', 'origin', status.branch], {
      authenticated: true
    })
  }
}

export async function pull(repoPath: string): Promise<void> {
  await git(repoPath, ['pull', '--ff-only'], { authenticated: true }).catch(async () => {
    await git(repoPath, ['pull'], { authenticated: true })
  })
}

export async function fetch(repoPath: string): Promise<void> {
  await git(repoPath, ['fetch', '--all', '--prune'], { authenticated: true })
}

export async function getRemoteUrl(repoPath: string): Promise<string | undefined> {
  const out = await git(repoPath, ['remote', 'get-url', 'origin']).catch(() => '')
  return out.trim() || undefined
}

// ---- Merge & conflict resolution ----

export async function isMerging(repoPath: string): Promise<boolean> {
  try {
    await git(repoPath, ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD'])
    return true
  } catch {
    return false
  }
}

async function conflictedFiles(repoPath: string): Promise<string[]> {
  const out = await git(repoPath, ['diff', '--name-only', '--diff-filter=U', '-z']).catch(
    () => ''
  )
  return out.split('\0').filter(Boolean)
}

export async function merge(repoPath: string, branch: string): Promise<MergeResult> {
  try {
    await git(repoPath, ['merge', '--no-edit', branch], { authenticated: true })
    return { conflicted: false, conflicts: [] }
  } catch (err) {
    if (await isMerging(repoPath)) {
      return { conflicted: true, conflicts: await conflictedFiles(repoPath) }
    }
    throw err
  }
}

export async function abortMerge(repoPath: string): Promise<void> {
  await git(repoPath, ['merge', '--abort'])
}

export async function continueMerge(repoPath: string, message?: string): Promise<void> {
  const remaining = await conflictedFiles(repoPath)
  if (remaining.length > 0) {
    throw new Error(`Resolve all conflicts first (${remaining.length} remaining).`)
  }
  if (message && message.trim()) {
    await git(repoPath, ['commit', '-m', message.trim()])
  } else {
    await git(repoPath, ['commit', '--no-edit'])
  }
}

export async function resolveUsing(
  repoPath: string,
  filePath: string,
  side: 'ours' | 'theirs'
): Promise<void> {
  await git(repoPath, ['checkout', `--${side}`, '--', filePath])
  await git(repoPath, ['add', '--', filePath])
}

/** Raw working-tree contents of a file (used to show conflict markers). */
export async function readWorkingFile(repoPath: string, filePath: string): Promise<string> {
  const full = `${repoPath.replace(/[\\/]+$/, '')}/${filePath}`
  try {
    return readFileSync(full, 'utf-8')
  } catch {
    return '(binary or unreadable file)'
  }
}

const CONFLICT_MARKER = /^(<{7} |={7}$|>{7} )/m

/**
 * Write resolved contents for a file. If no conflict markers remain the file is
 * staged (marking it resolved); otherwise it is left unmerged. Returns whether
 * it was staged.
 */
export async function writeConflictResolution(
  repoPath: string,
  filePath: string,
  content: string
): Promise<{ staged: boolean }> {
  const full = `${repoPath.replace(/[\\/]+$/, '')}/${filePath}`
  writeFileSync(full, content, 'utf-8')
  if (CONFLICT_MARKER.test(content)) return { staged: false }
  await git(repoPath, ['add', '--', filePath])
  return { staged: true }
}

export async function listBranches(repoPath: string): Promise<Branch[]> {
  const out = await git(repoPath, [
    'branch',
    '--format=%(refname:short)%09%(HEAD)%09%(upstream:short)'
  ])
  const branches: Branch[] = []
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const [name, head, upstream] = line.split('\t')
    branches.push({
      name,
      current: head === '*',
      upstream: upstream || undefined
    })
  }
  return branches
}

export async function checkoutBranch(repoPath: string, name: string): Promise<void> {
  await git(repoPath, ['checkout', name])
}

export async function createBranch(repoPath: string, name: string): Promise<void> {
  await git(repoPath, ['checkout', '-b', name])
}

export async function log(repoPath: string, limit = 100): Promise<Commit[]> {
  // Use unit separator (0x1f) between fields and record separator (0x1e) between commits.
  const format = ['%H', '%h', '%an', '%ae', '%at', '%s'].join('%x1f') + '%x1e'
  const out = await git(repoPath, [
    'log',
    `--max-count=${limit}`,
    `--pretty=format:${format}`
  ]).catch(() => '')
  const commits: Commit[] = []
  for (const record of out.split('\x1e')) {
    const trimmed = record.replace(/^\n/, '')
    if (!trimmed.trim()) continue
    const [hash, shortHash, author, email, date, subject] = trimmed.split('\x1f')
    commits.push({
      hash,
      shortHash,
      author,
      email,
      date: parseInt(date, 10),
      subject
    })
  }
  return commits
}

/** Returns a unified diff for a file. Falls back to file contents for untracked files. */
export async function getDiff(
  repoPath: string,
  filePath: string,
  staged: boolean,
  untracked: boolean
): Promise<string> {
  if (untracked) {
    const full = `${repoPath.replace(/[\\/]+$/, '')}/${filePath}`
    try {
      const content = readFileSync(full, 'utf-8')
      return content
        .split('\n')
        .map((l) => `+${l}`)
        .join('\n')
    } catch {
      return '(binary or unreadable file)'
    }
  }
  const args = ['diff']
  if (staged) args.push('--cached')
  args.push('--', filePath)
  return git(repoPath, args)
}

/** Diff used to feed the LLM for commit-message generation. */
export async function getStagedDiff(repoPath: string): Promise<string> {
  let diff = await git(repoPath, ['diff', '--cached'])
  if (!diff.trim()) {
    // Nothing staged: include working-tree changes so generation still works.
    diff = await git(repoPath, ['diff'])
  }
  return diff
}

function mapNameStatus(code: string): FileChangeStatus {
  switch (code[0]) {
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    case 'C':
      return 'copied'
    case 'U':
      return 'conflicted'
    case 'M':
    case 'T':
    default:
      return 'modified'
  }
}

/** Files changed by a single commit. */
export async function getCommitFiles(repoPath: string, hash: string): Promise<CommitFile[]> {
  const raw = await git(repoPath, [
    'diff-tree',
    '--no-commit-id',
    '--name-status',
    '--root',
    '-M',
    '-r',
    '-z',
    hash
  ])
  const files: CommitFile[] = []
  const parts = raw.split('\0')
  let i = 0
  while (i < parts.length) {
    const code = parts[i]
    if (!code) {
      i++
      continue
    }
    if (code[0] === 'R' || code[0] === 'C') {
      const oldPath = parts[i + 1]
      const path = parts[i + 2]
      files.push({ path, oldPath, status: mapNameStatus(code) })
      i += 3
    } else {
      const path = parts[i + 1]
      files.push({ path, status: mapNameStatus(code) })
      i += 2
    }
  }
  return files
}

/** Patch for a single file within a commit. */
export async function getCommitDiff(
  repoPath: string,
  hash: string,
  filePath: string
): Promise<string> {
  return git(repoPath, ['show', '--format=', '-M', hash, '--', filePath])
}

export async function listStashes(repoPath: string): Promise<Stash[]> {
  const out = await git(repoPath, [
    'stash',
    'list',
    '--format=%gd%x1f%gs'
  ]).catch(() => '')
  const stashes: Stash[] = []
  let index = 0
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const [ref, subject = ''] = line.split('\x1f')
    const branchMatch = subject.match(/^(?:WIP on|On) ([^:]+):/)
    stashes.push({
      ref,
      index: index++,
      message: subject.replace(/^(?:WIP on|On) [^:]+:\s*/, ''),
      branch: branchMatch?.[1]
    })
  }
  return stashes
}

export async function stashSave(repoPath: string, message?: string): Promise<void> {
  const args = ['stash', 'push', '--include-untracked']
  if (message && message.trim()) args.push('-m', message.trim())
  const out = await git(repoPath, args)
  if (/No local changes to save/i.test(out)) {
    throw new Error('No local changes to stash.')
  }
}

export async function stashPop(repoPath: string, ref: string): Promise<void> {
  await git(repoPath, ['stash', 'pop', ref])
}

export async function stashApply(repoPath: string, ref: string): Promise<void> {
  await git(repoPath, ['stash', 'apply', ref])
}

export async function stashDrop(repoPath: string, ref: string): Promise<void> {
  await git(repoPath, ['stash', 'drop', ref])
}

export async function clone(url: string, targetDir: string): Promise<string> {
  const parent = dirname(targetDir)
  const name = basename(targetDir)
  await git(parent, ['clone', url, name], { authenticated: true })
  return targetDir
}

/** Fetch a GitHub pull request into a local "pr/<number>" branch and check it out. */
export async function checkoutPullRequest(repoPath: string, prNumber: number): Promise<string> {
  const local = `pr/${prNumber}`
  await git(repoPath, ['fetch', 'origin', `+pull/${prNumber}/head:${local}`], {
    authenticated: true
  })
  await git(repoPath, ['checkout', local])
  return local
}

export function repoName(path: string): string {
  return basename(path.replace(/[\\/]+$/, ''))
}
