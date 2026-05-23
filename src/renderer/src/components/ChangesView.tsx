import { useState } from 'react'
import type { FileChange, RepoStatus } from '@shared/types'
import { statusLetter } from '../util'

interface Props {
  status: RepoStatus
  selectedPath: string | null
  busy: boolean
  generating: boolean
  hasProvider: boolean
  summary: string
  description: string
  onSummaryChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onSelectFile: (file: FileChange) => void
  onToggleFile: (file: FileChange, staged: boolean) => void
  onToggleAll: (staged: boolean) => void
  onDiscard: (file: FileChange) => void
  onCommit: () => void
  onGenerate: () => void
}

export function ChangesView(props: Props): JSX.Element {
  const { status } = props
  const [hover, setHover] = useState<string | null>(null)
  const allStaged = status.files.length > 0 && status.files.every((f) => f.staged)
  const stagedCount = status.files.filter((f) => f.staged).length

  return (
    <>
      <div className="file-list">
        <div className="file-list-header">
          <input
            type="checkbox"
            checked={allStaged}
            ref={(el) => {
              if (el) el.indeterminate = stagedCount > 0 && !allStaged
            }}
            onChange={(e) => props.onToggleAll(e.target.checked)}
            disabled={status.files.length === 0}
          />
          <span>
            {status.files.length} changed file{status.files.length === 1 ? '' : 's'}
          </span>
        </div>
        {status.files.map((file) => (
          <div
            key={file.path}
            className={`file-row ${props.selectedPath === file.path ? 'selected' : ''}`}
            onClick={() => props.onSelectFile(file)}
            onMouseEnter={() => setHover(file.path)}
            onMouseLeave={() => setHover(null)}
          >
            <input
              type="checkbox"
              checked={file.staged}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => props.onToggleFile(file, e.target.checked)}
            />
            <span className="path" title={file.path}>
              {file.path}
            </span>
            {hover === file.path && (
              <button
                className="btn-ghost"
                title="Discard changes"
                onClick={(e) => {
                  e.stopPropagation()
                  props.onDiscard(file)
                }}
              >
                ✕
              </button>
            )}
            <span
              className={`status-badge status-${file.status}`}
              title={file.status}
            >
              {statusLetter(file.status)}
            </span>
          </div>
        ))}
        {status.files.length === 0 && (
          <div className="placeholder" style={{ minHeight: 120 }}>
            No local changes. Your working tree is clean.
          </div>
        )}
      </div>

      <div className="commit-box">
        <input
          placeholder={stagedCount > 0 ? 'Summary (required)' : 'Stage files to commit'}
          value={props.summary}
          onChange={(e) => props.onSummaryChange(e.target.value)}
        />
        <textarea
          placeholder="Description"
          value={props.description}
          onChange={(e) => props.onDescriptionChange(e.target.value)}
        />
        <div className="commit-actions">
          <button
            className="btn"
            title={
              props.hasProvider
                ? 'Generate a commit message from your changes'
                : 'Configure an LLM provider in Settings first'
            }
            disabled={!props.hasProvider || props.generating || status.files.length === 0}
            onClick={props.onGenerate}
          >
            {props.generating ? <span className="spinner" /> : '✨'} AI message
          </button>
          <button
            className="btn-primary"
            disabled={props.busy || stagedCount === 0 || !props.summary.trim()}
            onClick={props.onCommit}
          >
            {props.busy ? <span className="spinner" /> : `Commit to ${status.branch}`}
          </button>
        </div>
      </div>
    </>
  )
}
