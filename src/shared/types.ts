// Types shared between the Electron main process, preload, and renderer.

export type FileChangeStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted'

export interface FileChange {
  path: string
  /** Original path for renames. */
  oldPath?: string
  status: FileChangeStatus
  /** Has changes staged in the index. */
  staged: boolean
  /** Has changes in the working tree that are not staged. */
  unstaged: boolean
}

export interface RepoStatus {
  branch: string
  /** Tracking branch, e.g. "origin/main". */
  upstream?: string
  ahead: number
  behind: number
  files: FileChange[]
  /** True when the working tree has no changes. */
  clean: boolean
}

export interface Branch {
  name: string
  current: boolean
  upstream?: string
}

export interface Commit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: number // unix seconds
  subject: string
}

export interface Repo {
  name: string
  path: string
}

export interface Stash {
  /** Stash ref, e.g. "stash@{0}". */
  ref: string
  index: number
  message: string
  /** Branch the stash was created on, when available. */
  branch?: string
}

/** A file changed by a single commit (used in the History view). */
export interface CommitFile {
  path: string
  oldPath?: string
  status: FileChangeStatus
}

export type LLMProviderType = 'ollama' | 'openai' | 'anthropic' | 'custom'

export interface LLMProviderConfig {
  id: string
  name: string
  type: LLMProviderType
  /** API base URL. Provider-specific defaults are applied when empty. */
  baseUrl: string
  apiKey?: string
  model: string
  /** Extra headers, used mainly by the "custom" provider type. */
  headers?: Record<string, string>
}

export interface AppSettings {
  repos: Repo[]
  providers: LLMProviderConfig[]
  activeProviderId?: string
  /** Optional override for the system prompt used to write commit messages. */
  commitSystemPrompt?: string
  github?: GitHubSettings
}

export interface GitHubSettings {
  token?: string
  /** OAuth App Client ID, required for device-flow sign-in. */
  oauthClientId?: string
  account?: GitHubAccount
}

export interface GitHubAccount {
  login: string
  name?: string
  avatarUrl?: string
  htmlUrl: string
}

export interface GitHubRepo {
  fullName: string
  name: string
  owner: string
  description?: string
  private: boolean
  cloneUrl: string
  defaultBranch: string
  updatedAt: string
  htmlUrl: string
}

export interface PullRequest {
  number: number
  title: string
  state: string
  draft: boolean
  author: string
  headRef: string
  baseRef: string
  htmlUrl: string
  createdAt: string
  body?: string
}

export interface DeviceCode {
  deviceCode: string
  userCode: string
  verificationUri: string
  interval: number
  expiresIn: number
}

/** Result of a merge attempt. */
export interface MergeResult {
  conflicted: boolean
  /** Files left in a conflicted state, when conflicted. */
  conflicts: string[]
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GitResult<T = void> {
  ok: boolean
  data?: T
  error?: string
}

export const PROVIDER_DEFAULT_BASE_URL: Record<LLMProviderType, string> = {
  ollama: 'http://localhost:11434',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  custom: ''
}

export const DEFAULT_COMMIT_SYSTEM_PROMPT =
  'You are a senior software engineer writing a git commit message. ' +
  'Given a git diff, write a concise, conventional commit message. ' +
  'The first line is a summary under 72 characters in the imperative mood ' +
  '(e.g. "Add user login validation"). If helpful, add a blank line then a short ' +
  'body explaining the "why". Respond with ONLY the commit message text, no code fences, ' +
  'no preamble, no quotes.'
