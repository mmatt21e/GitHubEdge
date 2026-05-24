import type {
  DeviceCode,
  GitHubAccount,
  GitHubRepo,
  PullRequest
} from '@shared/types'

const API = 'https://api.github.com'
const UA = 'GitHubEdge'

function apiHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': UA
  }
}

async function apiGet(token: string, path: string): Promise<any> {
  const res = await fetch(`${API}${path}`, { headers: apiHeaders(token) })
  const text = await res.text()
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      msg = JSON.parse(text).message || msg
    } catch {
      /* keep status */
    }
    throw new Error(`GitHub: ${msg}`)
  }
  return text ? JSON.parse(text) : {}
}

export async function getAuthenticatedUser(token: string): Promise<GitHubAccount> {
  const u = await apiGet(token, '/user')
  return {
    login: u.login,
    name: u.name ?? undefined,
    avatarUrl: u.avatar_url ?? undefined,
    htmlUrl: u.html_url
  }
}

export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = []
  // Fetch up to 3 pages (300 repos), most-recently-updated first.
  for (let page = 1; page <= 3; page++) {
    const data: any[] = await apiGet(
      token,
      `/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member&page=${page}`
    )
    for (const r of data) {
      repos.push({
        fullName: r.full_name,
        name: r.name,
        owner: r.owner?.login ?? '',
        description: r.description ?? undefined,
        private: !!r.private,
        cloneUrl: r.clone_url,
        defaultBranch: r.default_branch,
        updatedAt: r.updated_at,
        htmlUrl: r.html_url
      })
    }
    if (data.length < 100) break
  }
  return repos
}

export async function listPullRequests(
  token: string,
  owner: string,
  repo: string
): Promise<PullRequest[]> {
  const data: any[] = await apiGet(
    token,
    `/repos/${owner}/${repo}/pulls?state=open&per_page=50&sort=updated&direction=desc`
  )
  return data.map((p) => ({
    number: p.number,
    title: p.title,
    state: p.state,
    draft: !!p.draft,
    author: p.user?.login ?? '',
    headRef: p.head?.ref ?? '',
    baseRef: p.base?.ref ?? '',
    htmlUrl: p.html_url,
    createdAt: p.created_at,
    body: p.body ?? undefined
  }))
}

export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  params: { title: string; head: string; base: string; body?: string; draft?: boolean }
): Promise<PullRequest> {
  const res = await fetch(`${API}/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: { ...apiHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  const text = await res.text()
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const j = JSON.parse(text)
      msg = j.errors?.[0]?.message || j.message || msg
    } catch {
      /* keep status */
    }
    throw new Error(`GitHub: ${msg}`)
  }
  const p = JSON.parse(text)
  return {
    number: p.number,
    title: p.title,
    state: p.state,
    draft: !!p.draft,
    author: p.user?.login ?? '',
    headRef: p.head?.ref ?? '',
    baseRef: p.base?.ref ?? '',
    htmlUrl: p.html_url,
    createdAt: p.created_at,
    body: p.body ?? undefined
  }
}

/** Parse a GitHub remote URL into owner/repo. Supports HTTPS and SSH forms. */
export function parseGitHubRemote(url: string): { owner: string; repo: string } | null {
  const cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/, '')
  // git@github.com:owner/repo  or  ssh://git@github.com/owner/repo
  const ssh = cleaned.match(/github\.com[:/]([^/]+)\/([^/]+)$/)
  if (ssh) return { owner: ssh[1], repo: ssh[2] }
  return null
}

// ---- OAuth Device Flow ----

export async function deviceFlowStart(clientId: string): Promise<DeviceCode> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ client_id: clientId, scope: 'repo read:user' })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    interval: data.interval ?? 5,
    expiresIn: data.expires_in ?? 900
  }
}

/** Poll until the user authorizes the device, then return the access token. */
export async function deviceFlowPoll(
  clientId: string,
  deviceCode: string,
  intervalSeconds: number,
  expiresIn: number
): Promise<string> {
  let interval = intervalSeconds
  const deadline = Date.now() + expiresIn * 1000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval * 1000))
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    })
    const data = await res.json()
    if (data.access_token) return data.access_token as string
    switch (data.error) {
      case 'authorization_pending':
        break
      case 'slow_down':
        interval += 5
        break
      case 'expired_token':
        throw new Error('The authorization code expired. Please try signing in again.')
      case 'access_denied':
        throw new Error('Authorization was denied.')
      default:
        if (data.error) throw new Error(data.error_description || data.error)
    }
  }
  throw new Error('Sign-in timed out. Please try again.')
}
