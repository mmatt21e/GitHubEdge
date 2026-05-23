import {
  type ChatMessage,
  type LLMProviderConfig,
  PROVIDER_DEFAULT_BASE_URL
} from '@shared/types'

function baseUrlFor(provider: LLMProviderConfig): string {
  const url = (provider.baseUrl || PROVIDER_DEFAULT_BASE_URL[provider.type] || '').trim()
  return url.replace(/\/+$/, '')
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>
): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  })
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      const parsed = JSON.parse(text)
      detail = parsed.error?.message || parsed.error || parsed.message || text
    } catch {
      // keep raw text
    }
    throw new Error(`${res.status} ${res.statusText}: ${String(detail).slice(0, 500)}`)
  }
  return text ? JSON.parse(text) : {}
}

/** Send a chat completion request and return the assistant text. */
export async function chat(
  provider: LLMProviderConfig,
  messages: ChatMessage[]
): Promise<string> {
  const base = baseUrlFor(provider)
  if (!base && provider.type !== 'ollama') {
    throw new Error(`Provider "${provider.name}" has no base URL configured.`)
  }

  switch (provider.type) {
    case 'ollama': {
      const data = await postJson(
        `${base}/api/chat`,
        { model: provider.model, messages, stream: false },
        {}
      )
      return data?.message?.content ?? ''
    }

    case 'anthropic': {
      const system = messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n')
      const nonSystem = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }))
      const data = await postJson(
        `${base}/messages`,
        {
          model: provider.model,
          max_tokens: 1024,
          ...(system ? { system } : {}),
          messages: nonSystem
        },
        {
          'x-api-key': provider.apiKey ?? '',
          'anthropic-version': '2023-06-01'
        }
      )
      const block = Array.isArray(data?.content)
        ? data.content.find((c: any) => c.type === 'text')
        : undefined
      return block?.text ?? ''
    }

    case 'openai':
    case 'custom':
    default: {
      const headers: Record<string, string> = { ...(provider.headers ?? {}) }
      if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`
      const data = await postJson(
        `${base}/chat/completions`,
        { model: provider.model, messages, stream: false },
        headers
      )
      return data?.choices?.[0]?.message?.content ?? ''
    }
  }
}

async function streamLines(
  res: Response,
  onLine: (line: string) => void
): Promise<void> {
  if (!res.body) return
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).replace(/\r$/, '')
      buffer = buffer.slice(nl + 1)
      if (line) onLine(line)
    }
  }
  const tail = buffer.trim()
  if (tail) onLine(tail)
}

/**
 * Stream a chat completion, invoking `onChunk` with each text delta.
 * Resolves with the full accumulated text. Falls back to a non-streaming
 * request if the endpoint or provider does not support streaming.
 */
export async function chatStream(
  provider: LLMProviderConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void
): Promise<string> {
  const base = baseUrlFor(provider)
  if (!base && provider.type !== 'ollama') {
    throw new Error(`Provider "${provider.name}" has no base URL configured.`)
  }

  let full = ''
  const emit = (text: string): void => {
    if (!text) return
    full += text
    onChunk(text)
  }

  try {
    if (provider.type === 'ollama') {
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: provider.model, messages, stream: true })
      })
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
      await streamLines(res, (line) => {
        try {
          const obj = JSON.parse(line)
          emit(obj?.message?.content ?? '')
        } catch {
          /* ignore keep-alive / partial */
        }
      })
      return full
    }

    if (provider.type === 'anthropic') {
      const system = messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n')
      const nonSystem = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch(`${base}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.apiKey ?? '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 1024,
          stream: true,
          ...(system ? { system } : {}),
          messages: nonSystem
        })
      })
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
      await streamLines(res, (line) => {
        if (!line.startsWith('data:')) return
        const data = line.slice(5).trim()
        try {
          const obj = JSON.parse(data)
          if (obj.type === 'content_block_delta') emit(obj.delta?.text ?? '')
        } catch {
          /* ignore */
        }
      })
      return full
    }

    // openai / custom: OpenAI-compatible SSE
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(provider.headers ?? {})
    }
    if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: provider.model, messages, stream: true })
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    await streamLines(res, (line) => {
      if (!line.startsWith('data:')) return
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const obj = JSON.parse(data)
        emit(obj?.choices?.[0]?.delta?.content ?? '')
      } catch {
        /* ignore */
      }
    })
    return full
  } catch (err) {
    // If we already streamed something, surface the partial result's error.
    if (full) return full
    // Otherwise fall back to a single non-streaming request.
    const text = await chat(provider, messages)
    onChunk(text)
    return text
  }
}

/** List available models for a provider where the API supports it. */
export async function listModels(provider: LLMProviderConfig): Promise<string[]> {
  const base = baseUrlFor(provider)
  try {
    if (provider.type === 'ollama') {
      const res = await fetch(`${base}/api/tags`)
      if (!res.ok) return []
      const data = await res.json()
      return (data?.models ?? []).map((m: any) => m.name).filter(Boolean)
    }
    if (provider.type === 'openai' || provider.type === 'custom') {
      const headers: Record<string, string> = { ...(provider.headers ?? {}) }
      if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`
      const res = await fetch(`${base}/models`, { headers })
      if (!res.ok) return []
      const data = await res.json()
      return (data?.data ?? []).map((m: any) => m.id).filter(Boolean)
    }
  } catch {
    return []
  }
  return []
}
