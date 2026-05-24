import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import type { AppSettings } from '@shared/types'
import { encryptSecret, decryptSecret } from './secrets'

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

function clone(settings: AppSettings): AppSettings {
  return JSON.parse(JSON.stringify(settings))
}

/** Transform secret fields in-place using the given function. */
function transformSecrets(
  settings: AppSettings,
  fn: (value: string | undefined) => string | undefined
): void {
  for (const provider of settings.providers) {
    if (provider.apiKey) provider.apiKey = fn(provider.apiKey)
  }
  if (settings.github?.token) settings.github.token = fn(settings.github.token)
}

export function loadSettings(): AppSettings {
  if (cache) return cache
  const file = settingsPath()
  if (existsSync(file)) {
    try {
      const raw = readFileSync(file, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      const merged = { ...DEFAULT_SETTINGS, ...parsed }
      transformSecrets(merged, decryptSecret)
      cache = merged
      return cache
    } catch {
      // Corrupt file: fall back to defaults rather than crashing.
    }
  }
  cache = { ...DEFAULT_SETTINGS }
  return cache
}

export function saveSettings(settings: AppSettings): AppSettings {
  cache = settings // keep decrypted secrets in memory
  const file = settingsPath()
  mkdirSync(dirname(file), { recursive: true })
  // Encrypt secrets only in the on-disk copy.
  const onDisk = clone(settings)
  transformSecrets(onDisk, encryptSecret)
  writeFileSync(file, JSON.stringify(onDisk, null, 2), 'utf-8')
  return cache
}
