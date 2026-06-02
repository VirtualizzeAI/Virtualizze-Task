import type { AIModelOption, AIProvider, AIProviderOption, AISettingsState } from '../types/ai'

const STORAGE_KEY = 'virtualizze-ai-settings'

export const AI_PROVIDERS: AIProviderOption[] = [
  { id: 'openai', label: 'OpenAI', description: 'Modelos GPT para tarefas gerais e planejamento.' },
  { id: 'anthropic', label: 'Anthropic', description: 'Modelos Claude com foco em contexto longo.' },
  { id: 'deepseek', label: 'DeepSeek', description: 'Modelos eficientes e acessíveis para análise.' },
]

export const AI_MODELS: Record<AIProvider, AIModelOption[]> = {
  openai: [
    { value: 'gpt-4.1-mini', label: 'GPT 4.1 Mini' },
    { value: 'gpt-4.1', label: 'GPT 4.1' },
    { value: 'gpt-5.1', label: 'GPT 5.1' },
  ],
  anthropic: [
    { value: 'claude-3-5-haiku-latest', label: 'Claude Heiku X' },
    { value: 'claude-3-7-sonnet-latest', label: 'Claude Sonnet Y' },
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  ],
}

const defaultState: AISettingsState = {
  apiKeys: {},
  defaultProvider: 'openai',
  modelByProvider: {
    openai: AI_MODELS.openai[0].value,
    anthropic: AI_MODELS.anthropic[0].value,
    deepseek: AI_MODELS.deepseek[0].value,
  },
}

export const getDefaultModel = (provider: AIProvider) => AI_MODELS[provider][0].value

export function loadAISettings(): AISettingsState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultState

  try {
    const parsed = JSON.parse(raw) as Partial<AISettingsState>
    return {
      apiKeys: parsed.apiKeys ?? {},
      defaultProvider: parsed.defaultProvider ?? defaultState.defaultProvider,
      modelByProvider: {
        openai: parsed.modelByProvider?.openai ?? defaultState.modelByProvider.openai,
        anthropic: parsed.modelByProvider?.anthropic ?? defaultState.modelByProvider.anthropic,
        deepseek: parsed.modelByProvider?.deepseek ?? defaultState.modelByProvider.deepseek,
      },
    }
  } catch {
    return defaultState
  }
}

export function saveAISettings(settings: AISettingsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function upsertApiKey(provider: AIProvider, apiKey: string) {
  const current = loadAISettings()
  const next: AISettingsState = {
    ...current,
    apiKeys: {
      ...current.apiKeys,
      [provider]: apiKey.trim(),
    },
  }
  saveAISettings(next)
  return next
}

export function removeApiKey(provider: AIProvider) {
  const current = loadAISettings()
  const { [provider]: _, ...rest } = current.apiKeys
  const next: AISettingsState = {
    ...current,
    apiKeys: rest,
  }
  saveAISettings(next)
  return next
}

export function setDefaultProvider(provider: AIProvider) {
  const current = loadAISettings()
  const next: AISettingsState = {
    ...current,
    defaultProvider: provider,
  }
  saveAISettings(next)
  return next
}

export function setProviderModel(provider: AIProvider, model: string) {
  const current = loadAISettings()
  const valid = AI_MODELS[provider].some((item) => item.value === model)
  const next: AISettingsState = {
    ...current,
    modelByProvider: {
      ...current.modelByProvider,
      [provider]: valid ? model : getDefaultModel(provider),
    },
  }
  saveAISettings(next)
  return next
}
