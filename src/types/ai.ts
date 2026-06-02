export type AIProvider = 'openai' | 'anthropic' | 'deepseek'

export interface AIModelOption {
  value: string
  label: string
}

export interface AIProviderOption {
  id: AIProvider
  label: string
  description: string
}

export interface AISettingsState {
  apiKeys: Partial<Record<AIProvider, string>>
  defaultProvider: AIProvider
  modelByProvider: Record<AIProvider, string>
}
