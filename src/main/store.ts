import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import type { AppSettings } from '@shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  repos: [],
  providers: [],
  activeProviderId: undefined,
  commitSystemPrompt: undefined
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'githubedge-settings.json')
}

let cache: AppSettings | null = null

export function loadSettings(): AppSettings {
  if (cache) return cache
  const file = settingsPath()
  if (existsSync(file)) {
    try {
      const raw = readFileSync(file, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      cache = { ...DEFAULT_SETTINGS, ...parsed }
      return cache
    } catch {
      // Corrupt file: fall back to defaults rather than crashing.
    }
  }
  cache = { ...DEFAULT_SETTINGS }
  return cache
}

export function saveSettings(settings: AppSettings): AppSettings {
  cache = settings
  const file = settingsPath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(settings, null, 2), 'utf-8')
  return cache
}
