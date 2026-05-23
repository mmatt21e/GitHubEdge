import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import * as git from './git'
import * as llm from './llm'
import { loadSettings, saveSettings } from './store'
import {
  type AppSettings,
  type ChatMessage,
  type LLMProviderConfig,
  type GitResult,
  DEFAULT_COMMIT_SYSTEM_PROMPT
} from '@shared/types'

/** Wrap an async handler so errors become a structured GitResult instead of throwing. */
function wrap<T>(fn: (...args: any[]) => Promise<T>) {
  return async (_event: unknown, ...args: any[]): Promise<GitResult<T>> => {
    try {
      const data = await fn(...args)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

function activeProvider(settings: AppSettings): LLMProviderConfig {
  const provider =
    settings.providers.find((p) => p.id === settings.activeProviderId) ??
    settings.providers[0]
  if (!provider) {
    throw new Error('No LLM provider configured. Add one in Settings.')
  }
  return provider
}

export function registerIpcHandlers(): void {
  // ---- Settings ----
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:save', (_e, settings: AppSettings) => saveSettings(settings))

  // ---- Dialogs ----
  ipcMain.handle('dialog:openDirectory', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('shell:openPath', (_e, path: string) => shell.openPath(path))
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url))

  // ---- Git ----
  ipcMain.handle('git:isRepo', wrap((path: string) => git.isGitRepo(path)))
  ipcMain.handle('git:status', wrap((path: string) => git.getStatus(path)))
  ipcMain.handle('git:stage', wrap((path: string, files: string[]) => git.stageFiles(path, files)))
  ipcMain.handle('git:unstage', wrap((path: string, files: string[]) => git.unstageFiles(path, files)))
  ipcMain.handle('git:stageAll', wrap((path: string) => git.stageAll(path)))
  ipcMain.handle('git:discard', wrap((path: string, files: string[]) => git.discardChanges(path, files)))
  ipcMain.handle('git:commit', wrap((path: string, message: string) => git.commit(path, message)))
  ipcMain.handle('git:push', wrap((path: string) => git.push(path)))
  ipcMain.handle('git:pull', wrap((path: string) => git.pull(path)))
  ipcMain.handle('git:fetch', wrap((path: string) => git.fetch(path)))
  ipcMain.handle('git:branches', wrap((path: string) => git.listBranches(path)))
  ipcMain.handle('git:checkout', wrap((path: string, name: string) => git.checkoutBranch(path, name)))
  ipcMain.handle('git:createBranch', wrap((path: string, name: string) => git.createBranch(path, name)))
  ipcMain.handle('git:log', wrap((path: string, limit?: number) => git.log(path, limit)))
  ipcMain.handle(
    'git:diff',
    wrap((path: string, file: string, staged: boolean, untracked: boolean) =>
      git.getDiff(path, file, staged, untracked)
    )
  )
  ipcMain.handle('git:commitFiles', wrap((path: string, hash: string) => git.getCommitFiles(path, hash)))
  ipcMain.handle(
    'git:commitDiff',
    wrap((path: string, hash: string, file: string) => git.getCommitDiff(path, hash, file))
  )

  // ---- Stash ----
  ipcMain.handle('git:stashList', wrap((path: string) => git.listStashes(path)))
  ipcMain.handle('git:stashSave', wrap((path: string, message?: string) => git.stashSave(path, message)))
  ipcMain.handle('git:stashPop', wrap((path: string, ref: string) => git.stashPop(path, ref)))
  ipcMain.handle('git:stashApply', wrap((path: string, ref: string) => git.stashApply(path, ref)))
  ipcMain.handle('git:stashDrop', wrap((path: string, ref: string) => git.stashDrop(path, ref)))
  ipcMain.handle(
    'git:clone',
    wrap(async (url: string, dir: string) => {
      const path = await git.clone(url, dir)
      const settings = loadSettings()
      if (!settings.repos.some((r) => r.path === path)) {
        settings.repos.push({ name: git.repoName(path), path })
        saveSettings(settings)
      }
      return { path, name: git.repoName(path) }
    })
  )
  ipcMain.handle(
    'git:addRepo',
    wrap(async (path: string) => {
      if (!(await git.isGitRepo(path))) {
        throw new Error('That folder is not a Git repository.')
      }
      const root = await git.repoRoot(path)
      const settings = loadSettings()
      if (!settings.repos.some((r) => r.path === root)) {
        settings.repos.push({ name: git.repoName(root), path: root })
        saveSettings(settings)
      }
      return { path: root, name: git.repoName(root) }
    })
  )
  ipcMain.handle(
    'git:removeRepo',
    wrap(async (path: string) => {
      const settings = loadSettings()
      settings.repos = settings.repos.filter((r) => r.path !== path)
      saveSettings(settings)
      return settings.repos
    })
  )

  // ---- LLM ----
  ipcMain.handle(
    'llm:chat',
    wrap(async (providerId: string | undefined, messages: ChatMessage[]) => {
      const settings = loadSettings()
      const provider =
        settings.providers.find((p) => p.id === providerId) ?? activeProvider(settings)
      return llm.chat(provider, messages)
    })
  )
  ipcMain.handle(
    'llm:listModels',
    wrap(async (provider: LLMProviderConfig) => llm.listModels(provider))
  )
  ipcMain.handle(
    'llm:generateCommitMessage',
    wrap(async (repoPath: string) => {
      const settings = loadSettings()
      const provider = activeProvider(settings)
      const diff = await git.getStagedDiff(repoPath)
      if (!diff.trim()) {
        throw new Error('No changes to summarize. Make some edits first.')
      }
      const truncated = diff.length > 14000 ? diff.slice(0, 14000) + '\n... (diff truncated)' : diff
      const messages: ChatMessage[] = [
        { role: 'system', content: settings.commitSystemPrompt || DEFAULT_COMMIT_SYSTEM_PROMPT },
        { role: 'user', content: `Write a commit message for this diff:\n\n${truncated}` }
      ]
      const text = await llm.chat(provider, messages)
      return text.trim().replace(/^["'`]+|["'`]+$/g, '')
    })
  )
  ipcMain.handle(
    'llm:generateCommitMessageStream',
    async (e, requestId: string, repoPath: string): Promise<GitResult<string>> => {
      try {
        const settings = loadSettings()
        const provider = activeProvider(settings)
        const diff = await git.getStagedDiff(repoPath)
        if (!diff.trim()) {
          throw new Error('No changes to summarize. Make some edits first.')
        }
        const truncated =
          diff.length > 14000 ? diff.slice(0, 14000) + '\n... (diff truncated)' : diff
        const messages: ChatMessage[] = [
          { role: 'system', content: settings.commitSystemPrompt || DEFAULT_COMMIT_SYSTEM_PROMPT },
          { role: 'user', content: `Write a commit message for this diff:\n\n${truncated}` }
        ]
        const channel = `llm:chunk:${requestId}`
        const text = await llm.chatStream(provider, messages, (chunk) => {
          if (!e.sender.isDestroyed()) e.sender.send(channel, chunk)
        })
        return { ok: true, data: text.trim().replace(/^["'`]+|["'`]+$/g, '') }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )
}
