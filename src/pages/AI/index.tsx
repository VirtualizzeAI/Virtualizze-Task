import { useRef, useState } from 'react'
import dayjs from 'dayjs'
import { useAppData } from '../../context/AppDataContext'
import { analyzeContent, type AIAnalysisResult } from '../../services/openai'
import { extractFileText } from '../../services/fileTextExtractor'
import {
  AI_MODELS,
  AI_PROVIDERS,
  loadAISettings,
  setProviderModel,
} from '../../services/aiSettings'
import type { AIProvider } from '../../types/ai'
import './style.css'

type Step = 'input' | 'loading' | 'review' | 'success'

interface ParsedTask {
  id: string
  title: string
  description: string
  dueDate: string
  responsible: string
  selected: boolean
}

const ACCEPTED_TYPES = '.txt,.md,.csv,.json,.xml,.html,.log,.pdf,.docx'

export default function AIPage() {
  const { projects, stages, createProject, createTask } = useAppData()
  const [aiSettings, setAiSettings] = useState(loadAISettings)
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(aiSettings.defaultProvider)
  const [selectedModel, setSelectedModel] = useState(
    aiSettings.modelByProvider[aiSettings.defaultProvider] ?? AI_MODELS[aiSettings.defaultProvider][0].value,
  )

  const [step, setStep] = useState<Step>('input')
  const [inputText, setInputText] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Review state
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null)
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')

  // Success state
  const [createdCount, setCreatedCount] = useState(0)
  const [createdProjectName, setCreatedProjectName] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const availableModels = AI_MODELS[selectedProvider]
  const selectedApiKey = aiSettings.apiKeys[selectedProvider]?.trim() ?? ''
  const isProviderConfigured = Boolean(selectedApiKey)

  const handleChangeProvider = (provider: AIProvider) => {
    setSelectedProvider(provider)
    const savedModel = aiSettings.modelByProvider[provider] ?? AI_MODELS[provider][0].value
    setSelectedModel(savedModel)
  }

  const handleChangeModel = (model: string) => {
    setSelectedModel(model)
    const next = setProviderModel(selectedProvider, model)
    setAiSettings(next)
  }

  /* ── Input handlers ── */

  const handleFileChange = (file: File | null) => {
    if (!file) return
    setUploadedFile(file)
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileChange(file)
  }

  const handleAnalyze = async () => {
    setError(null)

    let content = inputText.trim()

    if (uploadedFile) {
      try {
        const fileText = await extractFileText(uploadedFile)
        content = fileText.trim() + (content ? '\n\n' + content : '')
      } catch {
        setError('Não foi possível ler o arquivo. Verifique o formato e tente novamente.')
        return
      }
    }

    if (!content) {
      setError('Insira um texto ou faça upload de um arquivo para analisar.')
      return
    }

    if (!selectedApiKey) {
      setError('Configure a chave do provedor selecionado na página de Configurações.')
      return
    }

    setStep('loading')

    try {
      const projectNames = projects.map((p) => p.name)
      const result = await analyzeContent({
        content,
        projectNames,
        provider: selectedProvider,
        model: selectedModel,
        apiKey: selectedApiKey,
      })
      setAiResult(result)

      // Build parsed tasks
      const tasks: ParsedTask[] = (result.tasks ?? []).map((t) => ({
        id: crypto.randomUUID(),
        title: t.title,
        description: t.description,
        dueDate: t.dueDate ?? '',
        responsible: t.responsible ?? '',
        selected: true,
      }))
      setParsedTasks(tasks)

      // Auto-select identified project
      if (result.identifiedProject) {
        const match = projects.find(
          (p) => p.name.toLowerCase() === result.identifiedProject!.toLowerCase(),
        )
        setSelectedProjectId(match?.id ?? null)
      } else {
        setSelectedProjectId(null)
      }

      setShowNewProject(false)
      setNewProjectName(result.identifiedProject && !projects.find(
        (p) => p.name.toLowerCase() === result.identifiedProject!.toLowerCase()
      ) ? result.identifiedProject : '')
      setNewProjectDescription('')
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao analisar o conteúdo.')
      setStep('input')
    }
  }

  /* ── Review handlers ── */

  const toggleTask = (id: string) => {
    setParsedTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)),
    )
  }

  const selectedTasks = parsedTasks.filter((t) => t.selected)

  const handleProjectOption = (projectId: string | 'new') => {
    if (projectId === 'new') {
      setSelectedProjectId(null)
      setShowNewProject(true)
    } else {
      setSelectedProjectId(projectId)
      setShowNewProject(false)
    }
  }

  const canCreate =
    selectedTasks.length > 0 &&
    (selectedProjectId !== null || (showNewProject && newProjectName.trim().length > 0))

  const handleCreate = async () => {
    if (!canCreate) return
    setError(null)

    try {
      let finalProjectId: string
      let firstStageId: string
      let projectName: string

      if (selectedProjectId) {
        // Use existing project
        finalProjectId = selectedProjectId
        projectName = projects.find((p) => p.id === selectedProjectId)?.name ?? ''

        const projectStages = stages.filter((s) => s.projectId === finalProjectId)
        const backlogStage = projectStages[0]
        if (!backlogStage) {
          setError('O projeto ainda não possui etapas. Tente novamente.')
          return
        }
        firstStageId = backlogStage.id
      } else {
        // Create new project — returns both ID and first stage ID (avoids React state closure issue)
        const result = await createProject({
          name: newProjectName.trim(),
          description: newProjectDescription.trim(),
          dueDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
          budget: 0,
          responsibles: [],
          clientId: '',
          attachments: [],
        })
        finalProjectId = result.id
        firstStageId = result.firstStageId
        projectName = newProjectName.trim()
      }

      // Create all selected tasks in parallel
      await Promise.all(
        selectedTasks.map((t) =>
          createTask({
            title: t.title,
            description: t.description,
            dueDate: t.dueDate || dayjs().add(7, 'day').format('YYYY-MM-DD'),
            responsible: t.responsible,
            manualMinutes: 0,
            projectId: finalProjectId,
            stageId: firstStageId,
            attachments: [],
          }),
        ),
      )

      setCreatedCount(selectedTasks.length)
      setCreatedProjectName(projectName)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar as tarefas.')
    }
  }

  const handleReset = () => {
    setStep('input')
    setInputText('')
    setUploadedFile(null)
    setError(null)
    setAiResult(null)
    setParsedTasks([])
    setSelectedProjectId(null)
    setShowNewProject(false)
    setNewProjectName('')
    setNewProjectDescription('')
  }

  const confidenceLabel = {
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
  }

  /* ── Render ── */
  return (
    <div className="ai-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">IA — Criar Tarefas</h1>
          <p className="page-subtitle">
            Envie um texto ou arquivo e a IA extrai as tarefas automaticamente
          </p>
        </div>
      </div>

      {/* ── Loading ── */}
      {step === 'loading' && (
        <div className="ai-loading">
          <div className="ai-loading-spinner" />
          <p>Analisando o conteúdo com IA...</p>
        </div>
      )}

      {/* ── Input ── */}
      {step === 'input' && (
        <div className="ai-input-card">
          <div className="ai-input-header">
            <div className="ai-input-header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 12 2.1 8.5"/>
              </svg>
            </div>
            <div>
              <h2>Analisar conteúdo</h2>
              <p>Cole o texto com as tarefas ou faça upload de um arquivo</p>
            </div>
          </div>

          <div className="ai-provider-row">
            <div className="ai-provider-field">
              <label>Provedor de IA</label>
              <select
                value={selectedProvider}
                onChange={(e) => handleChangeProvider(e.target.value as AIProvider)}
              >
                {AI_PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.label}</option>
                ))}
              </select>
            </div>
            <div className="ai-provider-field">
              <label>Modelo</label>
              <select value={selectedModel} onChange={(e) => handleChangeModel(e.target.value)}>
                {availableModels.map((model) => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            className="ai-textarea"
            placeholder="Cole aqui seu plano de ação, lista de tarefas, e-mail, ata de reunião ou qualquer texto com atividades a realizar..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />

          <div className="ai-divider">ou faça upload de um arquivo</div>

          {/* Dropzone */}
          {uploadedFile ? (
            <div className="ai-file-selected">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              {uploadedFile.name}
              <button
                className="ai-file-remove"
                onClick={() => { setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                type="button"
                aria-label="Remover arquivo"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ) : (
            <div
              className={`ai-dropzone${isDragOver ? ' drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <div className="ai-dropzone-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p>Arraste um arquivo ou <strong>clique para selecionar</strong></p>
              <span>Suportados: .txt, .md, .csv, .json, .xml, .html, .log, .pdf, .docx</span>
            </div>
          )}

          {!isProviderConfigured && (
            <div className="ai-config-inline">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>
                Sem chave configurada para este provedor.
                <a href="/settings"> Ir para Configurações</a>
              </span>
            </div>
          )}

          {error && (
            <div className="ai-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <div className="ai-actions">
            <button className="btn btn-primary" onClick={handleAnalyze} disabled={!isProviderConfigured}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/>
              </svg>
              Analisar com IA
            </button>
          </div>
        </div>
      )}

      {/* ── Review ── */}
      {step === 'review' && aiResult && (
        <>
          {error && (
            <div className="ai-error" style={{ marginBottom: '1rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <div className="ai-result-card">
            {/* Summary */}
            <div className="ai-result-section">
              <p className="ai-result-section-title">Resumo da análise</p>
              <div className="ai-summary-box">{aiResult.summary}</div>
            </div>

            {/* Project */}
            <div className="ai-result-section">
              <p className="ai-result-section-title">Projeto</p>

              {selectedProjectId && !showNewProject ? (
                // Project identified and confirmed
                <div className="ai-project-identified">
                  <div className="ai-project-badge">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/>
                    </svg>
                    {projects.find((p) => p.id === selectedProjectId)?.name}
                  </div>
                  {aiResult.identifiedProject && (
                    <span className="ai-confidence">
                      Confiança:{' '}
                      <span className={`ai-confidence-${aiResult.confidence}`}>
                        {confidenceLabel[aiResult.confidence]}
                      </span>
                    </span>
                  )}
                  <button className="ai-change-project-btn" onClick={() => setSelectedProjectId(null)} type="button">
                    Trocar projeto
                  </button>
                </div>
              ) : (
                // Need to select project
                <div className="ai-project-selector">
                  {!aiResult.identifiedProject && (
                    <p className="ai-project-selector-label">
                      A IA não identificou o projeto. Selecione um existente ou crie um novo:
                    </p>
                  )}
                  {aiResult.identifiedProject && !selectedProjectId && (
                    <p className="ai-project-selector-label">
                      A IA sugeriu <strong>"{aiResult.identifiedProject}"</strong> mas não encontrou correspondência. Selecione ou crie:
                    </p>
                  )}

                  <div className="ai-project-list">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`ai-project-option${selectedProjectId === p.id && !showNewProject ? ' selected' : ''}`}
                        onClick={() => handleProjectOption(p.id)}
                      >
                        <span className="ai-project-dot" />
                        {p.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`ai-project-option create-new${showNewProject ? ' selected' : ''}`}
                      onClick={() => handleProjectOption('new')}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      Criar novo projeto
                    </button>
                  </div>

                  {showNewProject && (
                    <div className="ai-new-project-form">
                      <div>
                        <label>Nome do projeto *</label>
                        <input
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="Ex: Site institucional"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label>Descrição (opcional)</label>
                        <textarea
                          value={newProjectDescription}
                          onChange={(e) => setNewProjectDescription(e.target.value)}
                          placeholder="Descreva brevemente o projeto..."
                          rows={2}
                          style={{ resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tasks */}
            <div className="ai-result-section">
              <p className="ai-result-section-title">Tarefas identificadas</p>
              <p className="ai-tasks-count">
                {selectedTasks.length} de {parsedTasks.length} selecionadas
              </p>
              <div className="ai-tasks-list">
                {parsedTasks.map((task) => (
                  <div key={task.id} className="ai-task-item">
                    <input
                      type="checkbox"
                      className="ai-task-check"
                      checked={task.selected}
                      onChange={() => toggleTask(task.id)}
                      id={`task-${task.id}`}
                    />
                    <label className="ai-task-content" htmlFor={`task-${task.id}`} style={{ cursor: 'pointer' }}>
                      <p className="ai-task-title">{task.title}</p>
                      {task.description && <p className="ai-task-desc">{task.description}</p>}
                      <div className="ai-task-meta">
                        {task.dueDate && (
                          <span className="ai-task-meta-item">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            {dayjs(task.dueDate).format('DD/MM/YYYY')}
                          </span>
                        )}
                        {task.responsible && (
                          <span className="ai-task-meta-item">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 8 0v2"/>
                            </svg>
                            {task.responsible}
                          </span>
                        )}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="ai-result-footer">
              <span className="ai-result-footer-info">
                <strong>{selectedTasks.length}</strong>{' '}
                {selectedTasks.length === 1 ? 'tarefa será criada' : 'tarefas serão criadas'}
                {(selectedProjectId || (showNewProject && newProjectName.trim())) && (
                  <>
                    {' '}em{' '}
                    <strong>
                      {selectedProjectId
                        ? projects.find((p) => p.id === selectedProjectId)?.name
                        : newProjectName.trim()}
                    </strong>
                  </>
                )}
              </span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-ghost" onClick={handleReset} type="button">
                  Recomeçar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleCreate}
                  disabled={!canCreate}
                  type="button"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Criar tarefas
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Success ── */}
      {step === 'success' && (
        <div className="ai-success">
          <div className="ai-success-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h3>
            {createdCount} {createdCount === 1 ? 'tarefa criada' : 'tarefas criadas'} com sucesso!
          </h3>
          <p>
            As tarefas foram adicionadas ao projeto <strong>{createdProjectName}</strong>.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button className="btn btn-ghost" onClick={handleReset} type="button">
              Analisar novo conteúdo
            </button>
            <a className="btn btn-primary" href="/kanban">
              Ver no Kanban
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
