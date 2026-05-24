import type { FileChangeStatus, GitResult } from '@shared/types'

/** Throw on error, otherwise return the payload. */
export function unwrap<T>(result: GitResult<T>): T {
  if (!result.ok) throw new Error(result.error || 'Operation failed')
  return result.data as T
}

export function statusLetter(status: FileChangeStatus): string {
  switch (status) {
    case 'modified':
      return 'M'
    case 'added':
      return 'A'
    case 'deleted':
      return 'D'
    case 'renamed':
      return 'R'
    case 'copied':
      return 'C'
    case 'untracked':
      return 'U'
    case 'conflicted':
      return '!'
  }
}

export function diffLineClass(line: string): string {
  if (
    line.startsWith('<<<<<<<') ||
    line.startsWith('=======') ||
    line.startsWith('>>>>>>>') ||
    line.startsWith('|||||||')
  )
    return 'diff-line conflict'
  if (line.startsWith('@@')) return 'diff-line hunk'
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') ||
      line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file') ||
      line.startsWith('rename ') || line.startsWith('similarity '))
    return 'diff-line meta'
  if (line.startsWith('+')) return 'diff-line add'
  if (line.startsWith('-')) return 'diff-line del'
  return 'diff-line'
}

export function relativeTime(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds
  const mins = Math.floor(diff / 60)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(unixSeconds * 1000).toLocaleDateString()
}

export function uuid(): string {
  return crypto.randomUUID()
}

const EXT_LANGUAGE: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  m: 'objectivec',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  ps1: 'powershell',
  html: 'xml',
  xml: 'xml',
  vue: 'xml',
  svg: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  md: 'markdown',
  markdown: 'markdown',
  sql: 'sql',
  dockerfile: 'dockerfile',
  lua: 'lua',
  r: 'r',
  dart: 'dart'
}

/** Best-effort highlight.js language id for a file path, or undefined. */
export function languageForPath(path: string | undefined): string | undefined {
  if (!path) return undefined
  const base = path.split(/[\\/]/).pop() ?? ''
  if (/^dockerfile/i.test(base)) return 'dockerfile'
  if (/^makefile/i.test(base)) return 'makefile'
  const ext = base.includes('.') ? base.split('.').pop()!.toLowerCase() : ''
  return EXT_LANGUAGE[ext]
}

