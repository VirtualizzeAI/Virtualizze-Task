import type { AIProvider } from '../types/ai'

interface AnalyzeContentInput {
  content: string
  projectNames: string[]
  provider: AIProvider
  model: string
  apiKey: string
}

export interface AITaskSuggestion {
  title: string
  description: string
  dueDate: string
  responsible: string
}

export interface AIAnalysisResult {
  identifiedProject: string | null
  confidence: 'high' | 'medium' | 'low'
  summary: string
  tasks: AITaskSuggestion[]
}

export async function analyzeContent({
  content,
  projectNames,
  provider,
  model,
  apiKey,
}: AnalyzeContentInput): Promise<AIAnalysisResult> {
  if (!apiKey.trim()) throw new Error('Chave da API não configurada para o provedor selecionado.')

  const projectList =
    projectNames.length > 0
      ? `Projetos existentes no sistema: ${projectNames.join(', ')}`
      : 'Nenhum projeto cadastrado no sistema ainda.'

  const systemPrompt = `Você é um assistente de gestão de projetos. Analise o texto fornecido pelo usuário e extraia as tarefas/ações a serem realizadas.

${projectList}

Regras:
- Se o texto mencionar ou for claramente relacionado a um dos projetos existentes, coloque o nome EXATO do projeto em "identifiedProject".
- Caso o projeto não seja identificável no texto, retorne null em "identifiedProject".
- Extraia TODAS as tarefas, ações ou itens de trabalho mencionados no texto.
- Para "dueDate", use formato YYYY-MM-DD se houver data indicada, caso contrário retorne string vazia.
- Para "responsible", extraia o nome da pessoa responsável se mencionada, caso contrário retorne string vazia.
- O campo "confidence" indica sua certeza sobre a identificação do projeto: "high" (muito clara), "medium" (provável), "low" (pouco provável).

Retorne APENAS um JSON válido com esta estrutura exata:
{
  "identifiedProject": "Nome exato do projeto ou null",
  "confidence": "high|medium|low",
  "summary": "Resumo em 1-2 frases do conteúdo analisado",
  "tasks": [
    {
      "title": "Título objetivo da tarefa",
      "description": "Descrição detalhada do que deve ser feito",
      "dueDate": "YYYY-MM-DD ou string vazia",
      "responsible": "Nome do responsável ou string vazia"
    }
  ]
}`

  const response = await sendProviderRequest({
    provider,
    model,
    apiKey,
    systemPrompt,
    content,
  })

  if (!response.ok) {
    const err = (await response.json()) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `Erro ${response.status} ao chamar o provedor de IA`)
  }

  const parsed = await parseProviderResponse(provider, response)
  return parsed
}

async function sendProviderRequest({
  provider,
  model,
  apiKey,
  systemPrompt,
  content,
}: {
  provider: AIProvider
  model: string
  apiKey: string
  systemPrompt: string
  content: string
}) {
  if (provider === 'anthropic') {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
      }),
    })
  }

  const endpoint =
    provider === 'deepseek'
      ? 'https://api.deepseek.com/chat/completions'
      : 'https://api.openai.com/v1/chat/completions'

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  })
}

async function parseProviderResponse(provider: AIProvider, response: Response): Promise<AIAnalysisResult> {
  if (provider === 'anthropic') {
    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    const rawText = payload.content?.find((item) => item.type === 'text')?.text
    if (!rawText) throw new Error('Resposta inválida do provedor Anthropic.')
    return JSON.parse(rawText) as AIAnalysisResult
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const rawText = payload.choices?.[0]?.message?.content
  if (!rawText) throw new Error('Resposta inválida do provedor de IA.')
  return JSON.parse(rawText) as AIAnalysisResult
}
