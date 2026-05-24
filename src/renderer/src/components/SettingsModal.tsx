import { useState } from 'react'
import {
  type AppSettings,
  type LLMProviderConfig,
  type LLMProviderType,
  DEFAULT_COMMIT_SYSTEM_PROMPT,
  PROVIDER_DEFAULT_BASE_URL,
  REDACTED_SECRET
} from '@shared/types'
import { uuid } from '../util'

interface Props {
  settings: AppSettings
  onClose: () => void
  onSave: (settings: AppSettings) => void
  notify: (message: string, error?: boolean) => void
}

const PROVIDER_LABELS: Record<LLMProviderType, string> = {
  ollama: 'Local (Ollama)',
  openai: 'OpenAI / OpenAI-compatible',
  anthropic: 'Anthropic (Claude)',
  custom: 'Custom endpoint'
}

const MODEL_PLACEHOLDER: Record<LLMProviderType, string> = {
  ollama: 'llama3.1',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-latest',
  custom: 'model-name'
}

function newProvider(type: LLMProviderType): LLMProviderConfig {
  return {
    id: uuid(),
    name: PROVIDER_LABELS[type],
    type,
    baseUrl: PROVIDER_DEFAULT_BASE_URL[type],
    apiKey: '',
    model: '',
    headers: {}
  }
}

export function SettingsModal({ settings, onClose, onSave, notify }: Props): JSX.Element {
  const [draft, setDraft] = useState<AppSettings>(() =>
    JSON.parse(JSON.stringify(settings))
  )
  const [testing, setTesting] = useState<string | null>(null)
  const [newType, setNewType] = useState<LLMProviderType>('ollama')

  function updateProvider(id: string, patch: Partial<LLMProviderConfig>): void {
    setDraft((d) => ({
      ...d,
      providers: d.providers.map((p) => (p.id === id ? { ...p, ...patch } : p))
    }))
  }

  function addProvider(): void {
    const provider = newProvider(newType)
    setDraft((d) => ({
      ...d,
      providers: [...d.providers, provider],
      activeProviderId: d.activeProviderId ?? provider.id
    }))
  }

  function removeProvider(id: string): void {
    setDraft((d) => {
      const providers = d.providers.filter((p) => p.id !== id)
      return {
        ...d,
        providers,
        activeProviderId:
          d.activeProviderId === id ? providers[0]?.id : d.activeProviderId
      }
    })
  }

  async function testProvider(provider: LLMProviderConfig): Promise<void> {
    setTesting(provider.id)
    try {
      const res = await window.api.llm.chat(provider.id, [
        { role: 'user', content: 'Reply with the single word: ok' }
      ])
      // chat() uses the saved provider; for an unsaved draft, fall back to listModels.
      if (!res.ok) throw new Error(res.error)
      notify(`"${provider.name}" responded successfully.`)
    } catch (err) {
      // The provider may be unsaved; try a model listing instead.
      const models = await window.api.llm.listModels(provider)
      if (models.ok && (models.data?.length ?? 0) > 0) {
        notify(`Reachable. Found ${models.data!.length} model(s).`)
      } else {
        notify(
          `Test failed: ${err instanceof Error ? err.message : String(err)}. Save settings, then test.`,
          true
        )
      }
    } finally {
      setTesting(null)
    }
  }

  function save(): void {
    onSave(draft)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings · AI Providers</h2>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Appearance</label>
            <select
              value={draft.theme ?? 'system'}
              onChange={(e) =>
                setDraft((d) => ({ ...d, theme: e.target.value as AppSettings['theme'] }))
              }
              style={{ maxWidth: 200 }}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0 16px' }} />
          <p className="muted">
            Configure one or more models. The active provider (radio button) is used for AI
            commit messages. Keys are stored locally on this machine only.
          </p>

          {draft.providers.map((p) => (
            <div
              key={p.id}
              className={`provider-card ${draft.activeProviderId === p.id ? 'active' : ''}`}
            >
              <div className="provider-head">
                <label className="flex gap" style={{ alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="active-provider"
                    checked={draft.activeProviderId === p.id}
                    onChange={() => setDraft((d) => ({ ...d, activeProviderId: p.id }))}
                  />
                  <span className="title">{PROVIDER_LABELS[p.type]}</span>
                </label>
                <div className="flex gap">
                  <button
                    className="btn"
                    onClick={() => testProvider(p)}
                    disabled={testing === p.id}
                  >
                    {testing === p.id ? <span className="spinner" /> : 'Test'}
                  </button>
                  <button className="btn" onClick={() => removeProvider(p.id)}>
                    Remove
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Display name</label>
                <input
                  value={p.name}
                  onChange={(e) => updateProvider(p.id, { name: e.target.value })}
                />
              </div>

              <div className="row">
                <div className="field">
                  <label>Base URL</label>
                  <input
                    placeholder={PROVIDER_DEFAULT_BASE_URL[p.type] || 'https://…'}
                    value={p.baseUrl}
                    onChange={(e) => updateProvider(p.id, { baseUrl: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Model</label>
                  <input
                    placeholder={MODEL_PLACEHOLDER[p.type]}
                    value={p.model}
                    onChange={(e) => updateProvider(p.id, { model: e.target.value })}
                  />
                </div>
              </div>

              {p.type !== 'ollama' && (
                <div className="field">
                  <label>API key</label>
                  <input
                    type="password"
                    placeholder={
                      p.apiKey === REDACTED_SECRET
                        ? 'saved — leave blank to keep'
                        : p.type === 'custom'
                          ? 'optional'
                          : 'sk-…'
                    }
                    value={p.apiKey === REDACTED_SECRET ? '' : p.apiKey ?? ''}
                    onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
                  />
                  {p.type === 'custom' && (
                    <span className="hint">
                      Custom providers use an OpenAI-compatible /chat/completions endpoint.
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="flex gap" style={{ alignItems: 'center', marginTop: 8 }}>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as LLMProviderType)}
            >
              {Object.entries(PROVIDER_LABELS).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
            <button className="btn-accent" onClick={addProvider}>
              + Add provider
            </button>
          </div>

          <div className="field" style={{ marginTop: 24 }}>
            <label>Commit message system prompt</label>
            <textarea
              style={{ width: '100%', minHeight: 90 }}
              placeholder={DEFAULT_COMMIT_SYSTEM_PROMPT}
              value={draft.commitSystemPrompt ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, commitSystemPrompt: e.target.value || undefined }))
              }
            />
            <span className="hint">Leave blank to use the built-in default.</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-accent" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
