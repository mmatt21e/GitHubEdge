import { useState } from 'react'
import type { Commit } from '@shared/types'
import { relativeTime } from '../util'

interface Props {
  commits: Commit[]
  selectedHash: string | null
  onSelect: (commit: Commit) => void
}

export function HistoryView({ commits, selectedHash, onSelect }: Props): JSX.Element {
  const [filter, setFilter] = useState('')
  const f = filter.toLowerCase()
  const visible = filter
    ? commits.filter(
        (c) =>
          c.subject.toLowerCase().includes(f) ||
          c.author.toLowerCase().includes(f) ||
          c.shortHash.toLowerCase().includes(f) ||
          (c.tags ?? []).some((t) => t.toLowerCase().includes(f))
      )
    : commits

  return (
    <>
      {commits.length > 8 && (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>
          <input
            style={{ width: '100%' }}
            placeholder="Filter history…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      )}
      {commits.length === 0 ? (
        <div className="placeholder">No commits yet.</div>
      ) : (
        <div className="file-list">
          {visible.map((c) => (
            <div
              key={c.hash}
              className={`commit-row ${selectedHash === c.hash ? 'selected' : ''}`}
              onClick={() => onSelect(c)}
            >
              <div className="subject">
                {(c.tags ?? []).map((t) => (
                  <span key={t} className="tag-badge">
                    {t}
                  </span>
                ))}
                {c.subject}
              </div>
              <div className="meta">
                {c.author} · {relativeTime(c.date)} · {c.shortHash}
              </div>
            </div>
          ))}
          {visible.length === 0 && <div className="placeholder">No matching commits.</div>}
        </div>
      )}
    </>
  )
}
