import type { PullRequest } from '@shared/types'

export function PullRequestDetail({ pr }: { pr: PullRequest }): JSX.Element {
  return (
    <div className="pr-detail">
      <div className="diff-header">
        <div style={{ fontSize: 15 }}>
          {pr.title} <span className="muted">#{pr.number}</span>
        </div>
        <div className="muted" style={{ fontWeight: 400, fontSize: 11, marginTop: 2 }}>
          {pr.author} wants to merge {pr.headRef} → {pr.baseRef}
          {pr.draft ? ' · draft' : ''}
        </div>
      </div>
      <div style={{ padding: 16, overflow: 'auto' }}>
        <button
          className="btn-accent"
          style={{ marginBottom: 14 }}
          onClick={() => window.api.shell.openExternal(pr.htmlUrl)}
        >
          View on GitHub
        </button>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'inherit',
            margin: 0
          }}
        >
          {pr.body || 'No description provided.'}
        </pre>
      </div>
    </div>
  )
}
