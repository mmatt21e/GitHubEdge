import type { Commit, CommitFile } from '@shared/types'
import { statusLetter } from '../util'
import { DiffView } from './DiffView'

interface Props {
  commit: Commit
  files: CommitFile[]
  selectedPath: string | null
  diff: string | null
  diffLoading: boolean
  onSelectFile: (file: CommitFile) => void
}

export function CommitDetail({
  commit,
  files,
  selectedPath,
  diff,
  diffLoading,
  onSelectFile
}: Props): JSX.Element {
  return (
    <div className="commit-detail">
      <div className="diff-header">
        <div>{commit.subject}</div>
        <div className="muted" style={{ fontWeight: 400, fontSize: 11, marginTop: 2 }}>
          {commit.author} &lt;{commit.email}&gt; · {commit.shortHash} ·{' '}
          {new Date(commit.date * 1000).toLocaleString()}
        </div>
      </div>
      <div className="commit-files">
        {files.length === 0 && <div className="muted" style={{ padding: 8 }}>No file changes.</div>}
        {files.map((f) => (
          <div
            key={f.path}
            className={`file-row ${selectedPath === f.path ? 'selected' : ''}`}
            onClick={() => onSelectFile(f)}
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
      <DiffView diff={diff} loading={diffLoading} />
    </div>
  )
}
