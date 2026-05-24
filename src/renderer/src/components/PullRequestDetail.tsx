import { useState } from 'react'
import type { PullRequest } from '@shared/types'

interface Props {
  pr: PullRequest
  onCheckout: (pr: PullRequest) => Promise<void>
}

export function PullRequestDetail({ pr, onCheckout }: Props): JSX.Element {
  const [checkingOut, setCheckingOut] = useState(false)

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
