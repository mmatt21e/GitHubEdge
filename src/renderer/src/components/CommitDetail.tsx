import { useState } from 'react'
import type { Commit, CommitFile } from '@shared/types'
import { statusLetter } from '../util'
import { DiffView } from './DiffView'

interface Props {
  commit: Commit
  files: CommitFile[]
  selectedPath: string | null
  diff: string | null
  diffLoading: boolean
  isGitHubRepo: boolean
  onSelectFile: (file: CommitFile) => void
  onCreateTag: (name: string) => void
  onDeleteTag: (name: string) => void
  onPushTags: () => void
  onViewOnGitHub: (hash: string) => void
  notify: (message: string, error?: boolean) => void
}

export function CommitDetail(props: Props): JSX.Element {
  const { commit } = props
  const [tagging, setTagging] = useState(false)
  const [tagName, setTagName] = useState('')

  return (
    <div className="commit-detail">
      <div className="diff-header">
        <div>
          {(commit.tags ?? []).map((t) => (
            <span key={t} className="tag-badge">
              {t}
              <button
                className="tag-x"
                title={`Delete tag ${t}`}
                onClick={() => props.onDeleteTag(t)}
              >
                ✕
              </button>
            </span>
          ))}
          {commit.subject}
        </div>
        <div className="muted" style={{ fontWeight: 400, fontSize: 11, marginTop: 2 }}>
          {commit.author} &lt;{commit.email}&gt; · {commit.shortHash} ·{' '}
          {new Date(commit.date * 1000).toLocaleString()}
        </div>
        <div className="flex gap" style={{ marginTop: 6, flexWrap: 'wrap' }}>
          {tagging ? (
            <span className="flex" style={{ gap: 4 }}>
              <input
                placeholder="tag name"
                value={tagName}
                autoFocus
                onChange={(e) => setTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagName.trim()) {
                    props.onCreateTag(tagName.trim())
                    setTagName('')
                    setTagging(false)
                  } else if (e.key === 'Escape') {
                    setTagging(false)
                  }
                }}
              />
              <button
                className="btn-accent"
                disabled={!tagName.trim()}
                onClick={() => {
                  props.onCreateTag(tagName.trim())
                  setTagName('')
                  setTagging(false)
                }}
              >
                Create
              </button>
              <button className="btn" onClick={() => setTagging(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button className="btn" onClick={() => setTagging(true)}>
              ＋ Tag
            </button>
          )}
          <button className="btn" onClick={props.onPushTags}>
            Push tags
          </button>
          <button
            className="btn"
            onClick={() => {
              window.api.clipboard.write(commit.hash)
              props.notify('Commit SHA copied.')
            }}
          >
            Copy SHA
          </button>
          {props.isGitHubRepo && (
            <button className="btn" onClick={() => props.onViewOnGitHub(commit.hash)}>
              View on GitHub
            </button>
          )}
        </div>
      </div>
      <div className="commit-files">
        {props.files.length === 0 && (
          <div className="muted" style={{ padding: 8 }}>
            No file changes.
          </div>
        )}
        {props.files.map((f) => (
          <div
            key={f.path}
            className={`file-row ${props.selectedPath === f.path ? 'selected' : ''}`}
            onClick={() => props.onSelectFile(f)}
          >
            <span className="path" title={f.path}>
              {f.path}
            </span>
            <span className={`status-badge status-${f.status}`} title={f.status}>
              {statusLetter(f.status)}
            </span>
          </div>
        ))}
      </div>
      <DiffView filePath={props.selectedPath ?? undefined} diff={props.diff} loading={props.diffLoading} />
    </div>
  )
}
