import type { PullRequest } from '@shared/types'
import { relativeTime } from '../util'

interface Props {
  signedIn: boolean
  isGitHubRepo: boolean
  pulls: PullRequest[]
  loading: boolean
  selectedNumber: number | null
  onSelect: (pr: PullRequest) => void
  onCreate: () => void
  onRefresh: () => void
  onSignIn: () => void
}

export function PullRequestsView(props: Props): JSX.Element {
  if (!props.signedIn) {
    return (
      <div className="placeholder" style={{ flexDirection: 'column', gap: 12 }}>
        <span>Sign in to GitHub to view pull requests.</span>
        <button className="btn-accent" onClick={props.onSignIn}>
          Sign in
        </button>
      </div>
    )
  }
  if (!props.isGitHubRepo) {
    return <div className="placeholder">This repository's origin is not on GitHub.</div>
  }
  return (
    <>
      <div className="file-list-header">
        <span style={{ flex: 1 }}>
          {props.loading ? 'Loading…' : `${props.pulls.length} open pull request${props.pulls.length === 1 ? '' : 's'}`}
        </span>
        <button className="btn-ghost" title="Refresh" onClick={props.onRefresh}>
          ↻
        </button>
        <button className="btn-ghost" title="Create pull request" onClick={props.onCreate}>
          + New
        </button>
      </div>
      <div className="file-list">
        {!props.loading && props.pulls.length === 0 && (
          <div className="placeholder">No open pull requests.</div>
        )}
        {props.pulls.map((pr) => (
          <div
            key={pr.number}
            className={`commit-row ${props.selectedNumber === pr.number ? 'selected' : ''}`}
            onClick={() => props.onSelect(pr)}
          >
            <div className="subject">
              {pr.draft && <span className="muted">[draft] </span>}
              {pr.title}
            </div>
            <div className="meta">
              #{pr.number} · {pr.author} · {pr.headRef} → {pr.baseRef} ·{' '}
              {relativeTime(Date.parse(pr.createdAt) / 1000)}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
