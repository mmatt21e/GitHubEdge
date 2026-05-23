import type { Commit } from '@shared/types'
import { relativeTime } from '../util'

interface Props {
  commits: Commit[]
  selectedHash: string | null
  onSelect: (commit: Commit) => void
}

export function HistoryView({ commits, selectedHash, onSelect }: Props): JSX.Element {
  if (commits.length === 0) {
    return <div className="placeholder">No commits yet.</div>
  }
  return (
    <div className="file-list">
      {commits.map((c) => (
        <div
          key={c.hash}
          className={`commit-row ${selectedHash === c.hash ? 'selected' : ''}`}
          onClick={() => onSelect(c)}
        >
          <div className="subject">{c.subject}</div>
          <div className="meta">
            {c.author} · {relativeTime(c.date)} · {c.shortHash}
          </div>
        </div>
      ))}
    </div>
  )
}
