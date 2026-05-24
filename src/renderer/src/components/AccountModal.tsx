import { useState } from 'react'
import type { AppSettings, DeviceCode, GitHubAccount } from '@shared/types'

interface Props {
  settings: AppSettings
  onClose: () => void
  onSignedIn: (account: GitHubAccount) => void
  onSignedOut: () => void
  notify: (message: string, error?: boolean) => void
}

export function AccountModal({
  settings,
  onClose,
  onSignedIn,
  onSignedOut,
  notify
}: Props): JSX.Element {
  const account = settings.github?.account
  const [token, setToken] = useState('')
  const [clientId, setClientId] = useState(settings.github?.oauthClientId ?? '')
  const [busy, setBusy] = useState(false)
  const [device, setDevice] = useState<DeviceCode | null>(null)
  const [waiting, setWaiting] = useState(false)

  async function signInWithToken(): Promise<void> {
    if (!token.trim()) return
    setBusy(true)
    const res = await window.api.github.signIn(token.trim())
    setBusy(false)
    if (!res.ok) return notify(res.error!, true)
    notify(`Signed in as ${res.data!.login}.`)
    onSignedIn(res.data!)
  }

  async function startDeviceFlow(): Promise<void> {
    if (!clientId.trim()) return notify('Enter an OAuth App Client ID first.', true)
    setBusy(true)
    await window.api.github.saveClientId(clientId.trim())
    const start = await window.api.github.deviceStart()
    setBusy(false)
    if (!start.ok) return notify(start.error!, true)
    setDevice(start.data!)
    setWaiting(true)
    const poll = await window.api.github.devicePoll(
      start.data!.deviceCode,
      start.data!.interval,
      start.data!.expiresIn
    )
    setWaiting(false)
    setDevice(null)
    if (!poll.ok) return notify(poll.error!, true)
    notify(`Signed in as ${poll.data!.login}.`)
    onSignedIn(poll.data!)
  }

  async function signOut(): Promise<void> {
    const res = await window.api.github.signOut()
    if (!res.ok) return notify(res.error!, true)
    notify('Signed out of GitHub.')
    onSignedOut()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>GitHub account</h2>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {account ? (
            <div className="flex gap" style={{ alignItems: 'center' }}>
              {account.avatarUrl && (
                <img
                  src={account.avatarUrl}
                  width={56}
                  height={56}
                  style={{ borderRadius: '50%' }}
                  alt=""
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{account.name || account.login}</div>
                <div className="muted">@{account.login}</div>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    window.api.shell.openExternal(account.htmlUrl)
                  }}
                >
                  {account.htmlUrl}
                </a>
              </div>
              <button className="btn" onClick={signOut}>
                Sign out
              </button>
            </div>
          ) : (
            <>
              <div className="field">
                <label>Personal access token</label>
                <span className="hint">
                  Create one at github.com → Settings → Developer settings → Tokens (needs{' '}
                  <code>repo</code> scope). Stored locally only.
                </span>
                <div className="flex gap">
                  <input
                    style={{ flex: 1 }}
                    type="password"
                    placeholder="ghp_… or github_pat_…"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                  <button className="btn-accent" disabled={busy || !token.trim()} onClick={signInWithToken}>
                    {busy && !device ? <span className="spinner" /> : 'Sign in'}
                  </button>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '18px 0' }} />

              <div className="field">
                <label>Or sign in with GitHub (device flow)</label>
                <span className="hint">
                  Register an OAuth App on GitHub, enable device flow, and paste its Client ID.
                </span>
                <div className="flex gap">
                  <input
                    style={{ flex: 1 }}
                    placeholder="OAuth App Client ID (Iv1.…)"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    disabled={waiting}
                  />
                  <button
                    className="btn"
                    disabled={busy || waiting || !clientId.trim()}
                    onClick={startDeviceFlow}
                  >
                    {waiting ? <span className="spinner" /> : 'Start'}
                  </button>
                </div>
              </div>

              {device && (
                <div className="provider-card active" style={{ textAlign: 'center' }}>
                  <div className="muted">Enter this code at</div>
                  <button
                    className="btn-accent"
                    style={{ margin: '6px 0' }}
                    onClick={() => window.api.shell.openExternal(device.verificationUri)}
                  >
                    Open {device.verificationUri}
                  </button>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 4 }}>
                    {device.userCode}
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    <span className="spinner" /> Waiting for authorization…
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
