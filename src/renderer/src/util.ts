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
