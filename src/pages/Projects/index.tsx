import { useMemo, useState, type FormEvent } from 'react'
import dayjs from 'dayjs'
import { useAppData } from '../../context/AppDataContext'
import type { Attachment, Project } from '../../types/domain'
import { Modal } from '../../components/Modal'
import './style.css'

const toAttachmentList = (raw: string): Attachment[] =>
  raw.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ id: crypto.randomUUID(), name }))

const toResponsiblesList = (raw: string) =>
  raw.split(',').map((s) => s.trim()).filter(Boolean)

interface ProjectFormState {
  name: string; description: string; dueDate: string
  budget: string; responsibles: string; clientId: string; attachments: string
}
const emptyForm = (): ProjectFormState => ({
  name: '', description: '', dueDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
  budget: '', responsibles: '', clientId: '', attachments: '',
})
const projectToForm = (p: Project): ProjectFormState => ({
  name: p.name, description: p.description, dueDate: p.dueDate,
  budget: String(p.budget || ''), responsibles: p.responsibles.join(', '),
  clientId: p.clientId, attachments: p.attachments.map((a) => a.name).join(', '),
})

function ProjectForm({ initial, onSubmit, submitLabel }: {
  initial: ProjectFormState
  onSubmit: (f: ProjectFormState) => void
  submitLabel: string
}) {
  const [f, setF] = useState(initial)
  const set = (key: keyof ProjectFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((c) => ({ ...c, [key]: e.target.value }))
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(f) }}>
      <div className="fg">
        <div className="ff"><label>Nome do projeto *</label>
          <input value={f.name} onChange={set('name')} placeholder="Ex: Site institucional" required /></div>
        <div className="ff"><label>Prazo *</label>
          <input type="date" value={f.dueDate} onChange={set('dueDate')} required /></div>
        <div className="ff fg-full"><label>Descricao</label>
          <textarea value={f.description} onChange={set('description')} placeholder="Descreva o projeto..." /></div>
        <div className="ff"><label>Orcamento (R$)</label>
          <input type="number" min="0" step="0.01" value={f.budget} onChange={set('budget')} placeholder="0.00" /></div>
        <div className="ff"><label>Responsaveis (virgula)</label>
          <input value={f.responsibles} onChange={set('responsibles')} placeholder="Ana, Bruno" /></div>
        <div className="ff"><label>ID do cliente</label>
          <input value={f.clientId} onChange={set('clientId')} placeholder="ID do cliente" /></div>
        <div className="ff"><label>Anexos (virgula)</label>
          <input value={f.attachments} onChange={set('attachments')} placeholder="brief.pdf" /></div>
      </div>
      <div className="modal-footer"><button type="submit" className="btn btn-primary">{submitLabel}</button></div>
    </form>
  )
}

export default function ProjectsPage() {
  const { projects, tasks, stages, taskTodos, clients, createProject, updateProject } = useAppData()
  const [showCreate, setShowCreate] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [viewProject, setViewProject] = useState<Project | null>(null)

  const orderedProjects = useMemo(
    () => projects.slice().sort((a, b) => dayjs(b.createdAt).unix() - dayjs(a.createdAt).unix()),
    [projects],
  )

  const handleCreate = async (f: ProjectFormState) => {
    await createProject({
      name: f.name, description: f.description, dueDate: f.dueDate,
      budget: Number(f.budget || 0), responsibles: toResponsiblesList(f.responsibles),
      clientId: f.clientId, attachments: toAttachmentList(f.attachments),
    })
    setShowCreate(false)
  }

  const handleEdit = async (f: ProjectFormState) => {
    if (!editProject) return
    await updateProject(editProject.id, {
      name: f.name, description: f.description, dueDate: f.dueDate,
      budget: Number(f.budget || 0), responsibles: toResponsiblesList(f.responsibles),
      clientId: f.clientId, attachments: toAttachmentList(f.attachments),
    })
    setEditProject(null)
  }

  const getTaskStats = (projectId: string) => {
    const pt = tasks.filter((t) => t.projectId === projectId)
    return { total: pt.length, done: pt.filter((t) => t.status === 'done').length }
  }

  const getClientName = (clientId: string) => clients.find((c) => c.id === clientId)?.name ?? '\u2014'
  const isLate = (p: Project) => dayjs(p.dueDate).isBefore(dayjs(), 'day')

  return (
    <section className="projects-page">
      <div className="pg-header">
        <div className="pg-header-left">
          <h1>Projetos</h1>
          <p>{projects.length} projeto{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo projeto
        </button>
      </div>

      {orderedProjects.length === 0 ? (
        <div className="proj-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          <p>Nenhum projeto ainda. Crie o primeiro!</p>
        </div>
      ) : (
        <div className="proj-list-card">
          <div className="proj-list-header">
            <span>Nome</span><span>Cliente</span><span>Progresso</span><span>Prazo</span><span>Status</span>
          </div>
          {orderedProjects.map((p) => {
            const stats = getTaskStats(p.id)
            const late = isLate(p)
            const pct = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100)
            return (
              <button key={p.id} className="proj-list-row" onClick={() => setViewProject(p)}>
                <div className="proj-row-name">
                  <div className="proj-row-dot" />
                  <div>
                    <strong>{p.name}</strong>
                    {p.description && <span className="proj-row-desc">{p.description}</span>}
                  </div>
                </div>
                <span className="proj-row-client">{getClientName(p.clientId)}</span>
                <div className="proj-row-progress">
                  <div className="progress-wrap" style={{ flex: 1 }}>
                    <div className={`progress-fill ${pct === 100 ? 'green' : pct >= 50 ? 'amber' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="proj-pct-sm">{pct}%</span>
                </div>
                <span className="proj-row-date">{dayjs(p.dueDate).format('DD/MM/YYYY')}</span>
                <span>
                  {pct === 100
                    ? <span className="status-badge status-done">Concluido</span>
                    : late
                    ? <span className="status-badge status-late">Atrasado</span>
                    : <span className="status-badge status-in-progress">Em andamento</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="Novo projeto" onClose={() => setShowCreate(false)} size="lg">
          <ProjectForm initial={emptyForm()} onSubmit={handleCreate} submitLabel="Criar projeto" />
        </Modal>
      )}

      {viewProject && (
        <Modal title={viewProject.name} onClose={() => setViewProject(null)} size="xl">
          <ProjectTasksView
            tasks={tasks.filter((t) => t.projectId === viewProject.id)}
            stages={stages}
            taskTodos={taskTodos}
            onEdit={() => { setEditProject(viewProject); setViewProject(null) }}
          />
        </Modal>
      )}

      {editProject && (
        <Modal title={editProject.name} onClose={() => setEditProject(null)} size="lg">
          {(() => {
            const stats = getTaskStats(editProject.id)
            const pct = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100)
            return (
              <div className="proj-edit-stats">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div className="progress-wrap" style={{ flex: 1 }}>
                    <div className={`progress-fill ${pct === 100 ? 'green' : pct >= 50 ? 'amber' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand)', minWidth: 36 }}>{pct}%</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stats.done}/{stats.total} tarefas</span>
                </div>
              </div>
            )
          })()}
          <ProjectForm initial={projectToForm(editProject)} onSubmit={handleEdit} submitLabel="Salvar alteracoes" />
        </Modal>
      )}
    </section>
  )
}

function ProjectTasksView({ tasks, stages, taskTodos, onEdit }: {
  tasks: import('../../types/domain').Task[]
  stages: import('../../types/domain').ProjectStage[]
  taskTodos: import('../../types/domain').TaskTodo[]
  onEdit: () => void
}) {
  const getStage = (sid: string) => stages.find((s) => s.id === sid)

  const getTodoProgress = (taskId: string) => {
    const todos = taskTodos.filter((t) => t.taskId === taskId)
    if (todos.length === 0) return null
    const done = todos.filter((t) => t.done).length
    return { done, total: todos.length, pct: Math.round((done / todos.length) * 100) }
  }

  const isLate = (task: import('../../types/domain').Task) =>
    task.status !== 'done' && dayjs(task.dueDate).isBefore(dayjs(), 'day')

  return (
    <div className="proj-tasks-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {tasks.length} tarefa{tasks.length !== 1 ? 's' : ''}
        </span>
        <button type="button" className="btn btn-ghost" onClick={onEdit}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar projeto
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="task-empty" style={{ padding: '2rem' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <p>Nenhuma tarefa neste projeto ainda.</p>
        </div>
      ) : (
        <div className="proj-task-list">
          <div className="proj-task-header">
            <span>Tarefa</span><span>Etapa</span><span>Prazo</span><span>Progresso</span>
          </div>
          {tasks.map((task) => {
            const stage = getStage(task.stageId)
            const todoProgress = getTodoProgress(task.id)
            const late = isLate(task)
            const pct = todoProgress?.pct ?? (task.status === 'done' ? 100 : 0)
            return (
              <div key={task.id} className="proj-task-row">
                <div className="proj-task-name">
                  <strong>{task.title}</strong>
                  {task.responsible && <span className="proj-task-resp">{task.responsible}</span>}
                </div>
                <div className="proj-task-stage">
                  {stage && <span className="task-stage-dot" style={{ background: stage.color }} />}
                  <span>{stage?.name ?? '—'}</span>
                </div>
                <span className={`proj-task-date ${late ? 'late' : ''}`}>
                  {dayjs(task.dueDate).format('DD/MM/YY')}
                </span>
                <div className="proj-task-progress">
                  <div className="progress-wrap" style={{ flex: 1 }}>
                    <div className={`progress-fill ${pct === 100 ? 'green' : pct >= 50 ? 'amber' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="proj-pct-sm">{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
