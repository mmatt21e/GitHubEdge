import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  Branch,
  ChatMessage,
  Commit,
  GitResult,
  LLMProviderConfig,
  Repo,
  RepoStatus
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
      ipcRenderer.invoke('llm:generateCommitMessage', repoPath)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
