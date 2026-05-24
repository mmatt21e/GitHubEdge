import { useEffect, useState } from 'react'
import type { ChecksResult, PRComment, PullRequest } from '@shared/types'
import { relativeTime } from '../util'

interface Props {
  pr: PullRequest
  repoPath: string
  onCheckout: (pr: PullRequest) => Promise<void>
}

const CHECK_ICON: Record<string, string> = {
  success: '✓',
  failure: '✗',
  pending: '•',
  none: '–'
}

function conclusionIcon(run: { status: string; conclusion?: string }): string {
  if (run.status !== 'completed') return '•'
  switch (run.conclusion) {
    case 'success':
      return '✓'
    case 'skipped':
    case 'neutral':
      return '–'
    default:
      return '✗'
  }
}

export function PullRequestDetail({ pr, repoPath, onCheckout }: Props): JSX.Element {
  const [checkingOut, setCheckingOut] = useState(false)
  const [checks, setChecks] = useState<ChecksResult | null>(null)
  const [comments, setComments] = useState<PRComment[] | null>(null)

  useEffect(() => {
    setChecks(null)
    setComments(null)
    let active = true
    window.api.github.prChecks(repoPath, pr.headSha).then((res) => {
      if (active && res.ok) setChecks(res.data!)
    })
    window.api.github.prComments(repoPath, pr.number).then((res) => {
      if (active && res.ok) setComments(res.data!)
    })
    return () => {
      active = false
    }
  }, [repoPath, pr.number, pr.headSha])

  async function checkout(): Promise<void> {
    setCheckingOut(true)
    try {
      await onCheckout(pr)
    } finally {
      setCheckingOut(false)
    }
  }

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
        <div className="flex gap" style={{ marginBottom: 14 }}>
          <button className="btn-accent" disabled={checkingOut} onClick={checkout}>
            {checkingOut ? <span className="spinner" /> : 'Checkout locally'}
          </button>
          <button className="btn" onClick={() => window.api.shell.openExternal(pr.htmlUrl)}>
            View on GitHub
          </button>
        </div>

        {checks && checks.runs.length > 0 && (
          <div className="pr-section">
            <div className={`pr-section-title check-${checks.state}`}>
              {CHECK_ICON[checks.state]} Checks — {checks.state}
            </div>
            {checks.runs.map((run, i) => (
              <div key={i} className="check-row">
                <span className={`check-icon ${run.conclusion ?? run.status}`}>
                  {conclusionIcon(run)}
                </span>
                <span style={{ flex: 1 }}>{run.name}</span>
                {run.detailsUrl && (
                  <button
                    className="btn-ghost"
                    onClick={() => window.api.shell.openExternal(run.detailsUrl!)}
                  >
                    details
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pr-section">
          <div className="pr-section-title">Conversation</div>
          {comments === null && (
            <div className="muted">
              <span className="spinner" /> Loading…
            </div>
          )}
          {comments?.length === 0 && <div className="muted">No comments yet.</div>}
          {comments?.map((c, i) => (
            <div key={i} className="pr-comment">
              <div className="muted" style={{ fontSize: 11 }}>
                <strong>{c.author}</strong>
                {c.kind === 'review' && c.state && (
                  <span className={`review-badge review-${c.state}`}> {c.state.replace('_', ' ').toLowerCase()}</span>
                )}{' '}
                · {relativeTime(Date.parse(c.createdAt) / 1000)}
              </div>
              {c.body && (
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'inherit',
                    margin: '4px 0 0'
                  }}
                >
                  {c.body}
                </pre>
              )}
            </div>
          ))}
        </div>

        <div className="pr-section">
          <div className="pr-section-title">Description</div>
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
    </div>
  )
}
