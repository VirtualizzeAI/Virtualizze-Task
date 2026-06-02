import { useMemo, useState } from 'react'
import { Modal } from '../../components/Modal'
import {
  AI_MODELS,
  AI_PROVIDERS,
  getDefaultModel,
  loadAISettings,
  removeApiKey,
  setDefaultProvider,
  setProviderModel,
  upsertApiKey,
} from '../../services/aiSettings'
import type { AIProvider } from '../../types/ai'
import './style.css'

export default function SettingsPage() {
  const [settings, setSettings] = useState(loadAISettings)
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(null)
  const [apiKeyDraft, setApiKeyDraft] = useState('')

  const providerMap = useMemo(
    () => Object.fromEntries(AI_PROVIDERS.map((item) => [item.id, item])),
    [],
  )

  const openProviderModal = (provider: AIProvider) => {
    setActiveProvider(provider)
    setApiKeyDraft(settings.apiKeys[provider] ?? '')
  }

  const closeModal = () => {
    setActiveProvider(null)
    setApiKeyDraft('')
  }

  const saveApiKey = () => {
    if (!activeProvider) return
    if (!apiKeyDraft.trim()) return
    const next = upsertApiKey(activeProvider, apiKeyDraft)
    setSettings(next)
    closeModal()
  }

  const deleteApiKey = (provider: AIProvider) => {
    const next = removeApiKey(provider)
    setSettings(next)
    if (activeProvider === provider) closeModal()
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações de IA</h1>
          <p className="page-subtitle">
            Escolha provedor padrão, modelos por provedor e cadastre suas chaves de API
          </p>
        </div>
      </div>

      <section className="settings-card">
        <p className="settings-section-title">Provedor padrão</p>
        <div className="settings-provider-pills">
          {AI_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={`settings-provider-pill${settings.defaultProvider === provider.id ? ' active' : ''}`}
              onClick={() => setSettings(setDefaultProvider(provider.id))}
            >
              {provider.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-grid">
        {AI_PROVIDERS.map((provider) => {
          const hasKey = Boolean(settings.apiKeys[provider.id])
          const models = AI_MODELS[provider.id]

          return (
            <article key={provider.id} className="settings-provider-card">
              <div className="settings-provider-head">
                <div>
                  <h3>{provider.label}</h3>
                  <p>{provider.description}</p>
                </div>
                <span className={`settings-chip ${hasKey ? 'ok' : 'warn'}`}>
                  {hasKey ? 'Chave configurada' : 'Sem chave'}
                </span>
              </div>

              <div className="settings-provider-body">
                <label>Modelo padrão</label>
                <select
                  value={settings.modelByProvider[provider.id] ?? getDefaultModel(provider.id)}
                  onChange={(e) => setSettings(setProviderModel(provider.id, e.target.value))}
                >
                  {models.map((model) => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>

                <div className="settings-provider-actions">
                  <button className="btn btn-primary" type="button" onClick={() => openProviderModal(provider.id)}>
                    {hasKey ? 'Atualizar chave' : 'Adicionar chave'}
                  </button>
                  {hasKey && (
                    <button className="btn btn-ghost" type="button" onClick={() => deleteApiKey(provider.id)}>
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </section>

      {activeProvider && (
        <Modal
          title={`Configurar chave - ${providerMap[activeProvider].label}`}
          onClose={closeModal}
          size="sm"
        >
          <div className="settings-modal-content">
            <label>API Key</label>
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder="Cole sua chave aqui"
              autoFocus
            />
            <p>
              A chave é armazenada localmente no navegador deste dispositivo.
            </p>
            <div className="settings-modal-actions">
              <button className="btn btn-ghost" type="button" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" type="button" onClick={saveApiKey} disabled={!apiKeyDraft.trim()}>
                Salvar chave
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
