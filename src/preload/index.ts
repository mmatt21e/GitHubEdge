import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  Branch,
  ChatMessage,
  Commit,
  CommitFile,
  DeviceCode,
  GitHubAccount,
  GitHubRepo,
  GitResult,
  LLMProviderConfig,
  MergeResult,
  PullRequest,
  Repo,
  RepoStatus,
  Stash
} from '@shared/types'

const api = {
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    save: (settings: AppSettings): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:save', settings)
  },
  dialog: {
    openDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDirectory')
  },
  shell: {
    openPath: (path: string): Promise<string> => ipcRenderer.invoke('shell:openPath', path),
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url)
  },
  git: {
    isRepo: (path: string): Promise<GitResult<boolean>> => ipcRenderer.invoke('git:isRepo', path),
    status: (path: string): Promise<GitResult<RepoStatus>> => ipcRenderer.invoke('git:status', path),
    stage: (path: string, files: string[]): Promise<GitResult> =>
      ipcRenderer.invoke('git:stage', path, files),
    unstage: (path: string, files: string[]): Promise<GitResult> =>
      ipcRenderer.invoke('git:unstage', path, files),
    stageAll: (path: string): Promise<GitResult> => ipcRenderer.invoke('git:stageAll', path),
    discard: (path: string, files: string[]): Promise<GitResult> =>
      ipcRenderer.invoke('git:discard', path, files),
    commit: (path: string, message: string): Promise<GitResult> =>
      ipcRenderer.invoke('git:commit', path, message),
    push: (path: string): Promise<GitResult> => ipcRenderer.invoke('git:push', path),
    pull: (path: string): Promise<GitResult> => ipcRenderer.invoke('git:pull', path),
    fetch: (path: string): Promise<GitResult> => ipcRenderer.invoke('git:fetch', path),
    branches: (path: string): Promise<GitResult<Branch[]>> =>
      ipcRenderer.invoke('git:branches', path),
    checkout: (path: string, name: string): Promise<GitResult> =>
      ipcRenderer.invoke('git:checkout', path, name),
    createBranch: (path: string, name: string): Promise<GitResult> =>
      ipcRenderer.invoke('git:createBranch', path, name),
    log: (path: string, limit?: number): Promise<GitResult<Commit[]>> =>
      ipcRenderer.invoke('git:log', path, limit),
    diff: (
      path: string,
      file: string,
      staged: boolean,
      untracked: boolean
    ): Promise<GitResult<string>> => ipcRenderer.invoke('git:diff', path, file, staged, untracked),
    commitFiles: (path: string, hash: string): Promise<GitResult<CommitFile[]>> =>
      ipcRenderer.invoke('git:commitFiles', path, hash),
    commitDiff: (path: string, hash: string, file: string): Promise<GitResult<string>> =>
      ipcRenderer.invoke('git:commitDiff', path, hash, file),
    stashList: (path: string): Promise<GitResult<Stash[]>> =>
      ipcRenderer.invoke('git:stashList', path),
    stashSave: (path: string, message?: string): Promise<GitResult> =>
      ipcRenderer.invoke('git:stashSave', path, message),
    stashPop: (path: string, ref: string): Promise<GitResult> =>
      ipcRenderer.invoke('git:stashPop', path, ref),
    stashApply: (path: string, ref: string): Promise<GitResult> =>
      ipcRenderer.invoke('git:stashApply', path, ref),
    stashDrop: (path: string, ref: string): Promise<GitResult> =>
      ipcRenderer.invoke('git:stashDrop', path, ref),
    merge: (path: string, branch: string): Promise<GitResult<MergeResult>> =>
      ipcRenderer.invoke('git:merge', path, branch),
    mergeAbort: (path: string): Promise<GitResult> => ipcRenderer.invoke('git:mergeAbort', path),
    mergeContinue: (path: string, message?: string): Promise<GitResult> =>
      ipcRenderer.invoke('git:mergeContinue', path, message),
    isMerging: (path: string): Promise<GitResult<boolean>> =>
      ipcRenderer.invoke('git:isMerging', path),
    resolve: (path: string, file: string, side: 'ours' | 'theirs'): Promise<GitResult> =>
      ipcRenderer.invoke('git:resolve', path, file, side),
    fileContent: (path: string, file: string): Promise<GitResult<string>> =>
      ipcRenderer.invoke('git:fileContent', path, file),
    remoteUrl: (path: string): Promise<GitResult<string | undefined>> =>
      ipcRenderer.invoke('git:remoteUrl', path),
    clone: (url: string, dir: string): Promise<GitResult<Repo>> =>
      ipcRenderer.invoke('git:clone', url, dir),
    addRepo: (path: string): Promise<GitResult<Repo>> => ipcRenderer.invoke('git:addRepo', path),
    removeRepo: (path: string): Promise<GitResult<Repo[]>> =>
      ipcRenderer.invoke('git:removeRepo', path)
  },
  llm: {
    chat: (
      providerId: string | undefined,
      messages: ChatMessage[]
    ): Promise<GitResult<string>> => ipcRenderer.invoke('llm:chat', providerId, messages),
    listModels: (provider: LLMProviderConfig): Promise<GitResult<string[]>> =>
      ipcRenderer.invoke('llm:listModels', provider),
    generateCommitMessage: (repoPath: string): Promise<GitResult<string>> =>
      ipcRenderer.invoke('llm:generateCommitMessage', repoPath),
    generateCommitMessageStream: (
      repoPath: string,
      onChunk: (text: string) => void
    ): Promise<GitResult<string>> => {
      const requestId = crypto.randomUUID()
      const channel = `llm:chunk:${requestId}`
      const listener = (_e: unknown, chunk: string): void => onChunk(chunk)
      ipcRenderer.on(channel, listener)
      return ipcRenderer
        .invoke('llm:generateCommitMessageStream', requestId, repoPath)
        .finally(() => ipcRenderer.removeListener(channel, listener))
    }
  },
  github: {
    signIn: (token: string): Promise<GitResult<GitHubAccount>> =>
      ipcRenderer.invoke('github:signIn', token),
    signOut: (): Promise<GitResult> => ipcRenderer.invoke('github:signOut'),
    saveClientId: (clientId: string): Promise<GitResult> =>
      ipcRenderer.invoke('github:saveClientId', clientId),
    deviceStart: (): Promise<GitResult<DeviceCode>> => ipcRenderer.invoke('github:deviceStart'),
    devicePoll: (
      deviceCode: string,
      interval: number,
      expiresIn: number
    ): Promise<GitResult<GitHubAccount>> =>
      ipcRenderer.invoke('github:devicePoll', deviceCode, interval, expiresIn),
    repos: (): Promise<GitResult<GitHubRepo[]>> => ipcRenderer.invoke('github:repos'),
    pulls: (repoPath: string): Promise<GitResult<PullRequest[]>> =>
      ipcRenderer.invoke('github:pulls', repoPath),
    createPull: (
      repoPath: string,
      params: { title: string; base: string; body?: string; draft?: boolean }
    ): Promise<GitResult<PullRequest>> =>
      ipcRenderer.invoke('github:createPull', repoPath, params)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
