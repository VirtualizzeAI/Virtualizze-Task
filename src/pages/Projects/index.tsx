import { useMemo, useState, type FormEvent } from 'react'
import dayjs from 'dayjs'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useAppData } from '../../context/AppDataContext'
import type { Attachment, Project, Task, TaskStatus, ProjectStage } from '../../types/domain'
import { Modal } from '../../components/Modal'
import './style.css'

const stageToStatus = (stageName: string): TaskStatus => {
  const n = stageName.toLowerCase()
  if (n.includes('final') || n.includes('done') || n.includes('conclu')) return 'done'
  if (n.includes('andamento') || n.includes('doing') || n.includes('progress')) return 'in_progress'
  return 'todo'
}

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

function ProjectForm({ initial, onSubmit, submitLabel, clients }: {
  initial: ProjectFormState
  onSubmit: (f: ProjectFormState) => void
  submitLabel: string
  clients: { id: string; name: string }[]
}) {
  const [f, setF] = useState(initial)
  const set = (key: keyof ProjectFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
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
        <div className="ff"><label>Cliente</label>
          <select value={f.clientId} onChange={set('clientId')}>
            <option value="">Nenhum cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select></div>
        <div className="ff"><label>Anexos (virgula)</label>
          <input value={f.attachments} onChange={set('attachments')} placeholder="brief.pdf" /></div>
      </div>
      <div className="modal-footer"><button type="submit" className="btn btn-primary">{submitLabel}</button></div>
    </form>
  )
}

export default function ProjectsPage() {
  const { projects, tasks, stages, taskTodos, clients, createProject, updateProject, deleteProject } = useAppData()
  const [showCreate, setShowCreate] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [viewProject, setViewProject] = useState<Project | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)

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
          <ProjectForm initial={emptyForm()} onSubmit={handleCreate} submitLabel="Criar projeto" clients={clients} />
        </Modal>
      )}

      {viewProject && (
        <Modal title={viewProject.name} onClose={() => setViewProject(null)} size="2xl">
          <ProjectTasksView
            project={viewProject}
            clients={clients}
            tasks={tasks.filter((t) => t.projectId === viewProject.id)}
            stages={stages}
            taskTodos={taskTodos}
            onEdit={() => { setEditProject(viewProject); setViewProject(null) }}
            onDelete={() => {
              if (window.confirm('Tem certeza que deseja excluir este projeto e todas as suas tarefas?')) {
                void deleteProject(viewProject.id)
                setViewProject(null)
              }
            }}
            onCreateTask={() => setShowCreateTask(true)}
          />
        </Modal>
      )}

      {showCreateTask && viewProject && (
        <Modal title="Nova tarefa" onClose={() => setShowCreateTask(false)} size="md">
          <CreateTaskInProject
            projectId={viewProject.id}
            stages={stages.filter((s) => s.projectId === viewProject.id)}
            onDone={() => setShowCreateTask(false)}
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
          <ProjectForm initial={projectToForm(editProject)} onSubmit={handleEdit} submitLabel="Salvar alteracoes" clients={clients} />
        </Modal>
      )}
    </section>
  )
}

function ProjectTasksView({ project, clients, tasks, stages, taskTodos, onEdit, onDelete, onCreateTask }: {
  project: Project
  clients: { id: string; name: string }[]
  tasks: Task[]
  stages: ProjectStage[]
  taskTodos: import('../../types/domain').TaskTodo[]
  onEdit: () => void
  onDelete: () => void
  onCreateTask: () => void
}) {
  const { updateTaskStatus } = useAppData()
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [editTaskId, setEditTaskId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const getClientName = (clientId: string) => clients.find((c) => c.id === clientId)?.name ?? '\u2014'
  const isProjectLate = dayjs(project.dueDate).isBefore(dayjs(), 'day')
  const projectTasksDone = tasks.filter((t) => t.status === 'done').length
  const projectPct = tasks.length === 0 ? 0 : Math.round((projectTasksDone / tasks.length) * 100)

  const getStage = (sid: string) => stages.find((s) => s.id === sid)

  const getTodoProgress = (taskId: string) => {
    const todos = taskTodos.filter((t) => t.taskId === taskId)
    if (todos.length === 0) return null
    const done = todos.filter((t) => t.done).length
    return { done, total: todos.length, pct: Math.round((done / todos.length) * 100) }
  }

  const isLate = (task: Task) =>
    task.status !== 'done' && dayjs(task.dueDate).isBefore(dayjs(), 'day')

  const projectStages = stages.filter((s) => s.projectId === project.id).sort((a, b) => a.order - b.order)

  const tasksByStage = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const s of projectStages) map.set(s.id, [])
    for (const t of tasks) {
      const arr = map.get(t.stageId)
      if (arr) arr.push(t)
    }
    return map
  }, [projectStages, tasks])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragStart = ({ active }: DragStartEvent) => {
    const task = tasks.find((t) => t.id === active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null)
    if (!over) return
    const task = tasks.find((t) => t.id === active.id)
    if (!task || task.stageId === over.id) return
    const nextStage = projectStages.find((s) => s.id === over.id)
    if (!nextStage) return
    void updateTaskStatus(String(task.id), stageToStatus(nextStage.name), String(nextStage.id))
  }

  return (
    <div className="proj-tasks-view">
      <div className="proj-detail-info">
        <div className="proj-detail-grid">
          <div className="proj-detail-item">
            <span className="proj-detail-label">Cliente</span>
            <span className="proj-detail-value">{getClientName(project.clientId)}</span>
          </div>
          <div className="proj-detail-item">
            <span className="proj-detail-label">Prazo</span>
            <span className={`proj-detail-value ${isProjectLate ? 'late' : ''}`}>
              {dayjs(project.dueDate).format('DD/MM/YYYY')}
              {isProjectLate && ' (Atrasado)'}
            </span>
          </div>
          <div className="proj-detail-item">
            <span className="proj-detail-label">Orcamento</span>
            <span className="proj-detail-value">
              {project.budget > 0 ? `R$ ${project.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '\u2014'}
            </span>
          </div>
          <div className="proj-detail-item">
            <span className="proj-detail-label">Responsaveis</span>
            <span className="proj-detail-value">{project.responsibles.length > 0 ? project.responsibles.join(', ') : '\u2014'}</span>
          </div>
          <div className="proj-detail-item">
            <span className="proj-detail-label">Criado em</span>
            <span className="proj-detail-value">{dayjs(project.createdAt).format('DD/MM/YYYY')}</span>
          </div>
          <div className="proj-detail-item">
            <span className="proj-detail-label">Progresso</span>
            <div className="proj-detail-progress">
              <div className="progress-wrap" style={{ flex: 1 }}>
                <div className={`progress-fill ${projectPct === 100 ? 'green' : projectPct >= 50 ? 'amber' : ''}`} style={{ width: `${projectPct}%` }} />
              </div>
              <span className="proj-pct-sm">{projectPct}%</span>
            </div>
          </div>
        </div>
        {project.description && (
          <div className="proj-detail-desc">
            <span className="proj-detail-label">Descricao</span>
            <p>{project.description}</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {tasks.length} tarefa{tasks.length !== 1 ? 's' : ''}
          </span>
          {tasks.length > 0 && (
            <div className="proj-view-toggle">
              <button type="button" className={`proj-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="Lista">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
              <button type="button" className={`proj-view-btn ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => setViewMode('kanban')} title="Kanban">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/></svg>
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onCreateTask}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova tarefa
          </button>
          <button type="button" className="btn btn-ghost" onClick={onEdit}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar projeto
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Excluir projeto
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="task-empty" style={{ padding: '2rem' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <p>Nenhuma tarefa neste projeto ainda.</p>
        </div>
      ) : viewMode === 'list' ? (
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
              <div key={task.id} className="proj-task-row" onClick={() => setEditTaskId(task.id)} style={{ cursor: 'pointer' }}>
                <div className="proj-task-name">
                  <strong>{task.title}</strong>
                  {task.responsible && <span className="proj-task-resp">{task.responsible}</span>}
                </div>
                <div className="proj-task-stage">
                  {stage && <span className="task-stage-dot" style={{ background: stage.color }} />}
                  <span>{stage?.name ?? '\u2014'}</span>
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
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="proj-kanban-board">
            {projectStages.map((stage) => {
              const stageTasks = tasksByStage.get(stage.id) ?? []
              return (
                <ProjKanbanColumn
                  key={stage.id}
                  stage={stage}
                  tasks={stageTasks}
                  onTaskClick={(t) => setEditTaskId(t.id)}
                />
              )
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTask ? <ProjCardPreview task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {editTaskId && (
        <Modal title="Detalhes da tarefa" onClose={() => setEditTaskId(null)} size="lg">
          <TaskDetailModal taskId={editTaskId} stages={projectStages} onDone={() => setEditTaskId(null)} />
        </Modal>
      )}
    </div>
  )
}

function ProjDraggableCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  const isLate = task.status !== 'done' && dayjs(task.dueDate).isBefore(dayjs(), 'day')

  return (
    <div ref={setNodeRef} className={`proj-kanban-card ${isDragging ? 'proj-kanban-card-dragging' : ''}`} {...attributes}>
      <div className="proj-kanban-card-drag" {...listeners}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>
      <button className="proj-kanban-card-inner" onClick={onClick}>
        <div className="proj-kanban-card-title">{task.title}</div>
        {task.description && <div className="proj-kanban-card-desc">{task.description}</div>}
        <div className="proj-kanban-card-footer">
          <span className={`proj-kanban-card-date ${isLate ? 'late' : ''}`}>
            {dayjs(task.dueDate).format('DD/MM/YY')}
          </span>
          {task.responsible && (
            <span className="proj-kanban-card-avatar">{task.responsible.charAt(0).toUpperCase()}</span>
          )}
        </div>
      </button>
    </div>
  )
}

function ProjCardPreview({ task }: { task: Task }) {
  const isLate = task.status !== 'done' && dayjs(task.dueDate).isBefore(dayjs(), 'day')
  return (
    <div className="proj-kanban-card proj-kanban-card-overlay">
      <div className="proj-kanban-card-drag">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>
      <div className="proj-kanban-card-inner">
        <div className="proj-kanban-card-title">{task.title}</div>
        {task.description && <div className="proj-kanban-card-desc">{task.description}</div>}
        <div className="proj-kanban-card-footer">
          <span className={`proj-kanban-card-date ${isLate ? 'late' : ''}`}>{dayjs(task.dueDate).format('DD/MM/YY')}</span>
          {task.responsible && <span className="proj-kanban-card-avatar">{task.responsible.charAt(0).toUpperCase()}</span>}
        </div>
      </div>
    </div>
  )
}

function ProjKanbanColumn({ stage, tasks, onTaskClick }: {
  stage: ProjectStage
  tasks: Task[]
  onTaskClick: (task: Task) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id })

  return (
    <div className={`proj-kanban-col ${isOver ? 'proj-kanban-col-over' : ''}`}>
      <div className="proj-kanban-col-header">
        <div className="proj-kanban-col-title-row">
          <span className="proj-kanban-dot" style={{ background: stage.color }} />
          <span className="proj-kanban-col-name">{stage.name}</span>
        </div>
        <span className="proj-kanban-col-count">{tasks.length}</span>
      </div>
      <div className="proj-kanban-col-body" ref={setNodeRef}>
        {tasks.length === 0 ? (
          <div className="proj-kanban-empty">Nenhuma tarefa</div>
        ) : tasks.map((task) => (
          <ProjDraggableCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
        ))}
      </div>
    </div>
  )
}

function TaskDetailModal({ taskId, stages, onDone }: {
  taskId: string
  stages: ProjectStage[]
  onDone: () => void
}) {
  const {
    tasks, updateTaskFull, updateTaskStatus, updateTaskManualMinutes,
    startTaskTimer, stopTaskTimer,
    createTaskTodo, toggleTaskTodo, taskTodos, deleteTask, deleteTaskTodo,
  } = useAppData()

  const task = tasks.find((t) => t.id === taskId)

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [responsible, setResponsible] = useState(task?.responsible ?? '')
  const [stageId, setStageId] = useState(task?.stageId ?? '')
  const [manualMinutes, setManualMinutes] = useState(task?.manualMinutes ?? 0)
  const [todoDraft, setTodoDraft] = useState('')

  const todos = taskTodos.filter((t) => t.taskId === taskId)

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
  }

  const liveSeconds = useMemo(() => {
    if (!task) return 0
    if (!task.timerStartedAt) return task.trackedSeconds
    return task.trackedSeconds + Math.max(0, dayjs().diff(dayjs(task.timerStartedAt), 'second'))
  }, [task])

  if (!task) return null

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    await updateTaskFull(taskId, { title, description, dueDate, responsible, stageId, manualMinutes })
    if (stageId !== task.stageId) {
      const selectedStage = stages.find((s) => s.id === stageId)
      const newStatus = selectedStage ? stageToStatus(selectedStage.name) : task.status
      await updateTaskStatus(taskId, newStatus, stageId)
    } else if (manualMinutes !== task.manualMinutes) {
      await updateTaskManualMinutes(taskId, manualMinutes)
    }
    onDone()
  }

  const addTodo = () => {
    const t = todoDraft.trim()
    if (!t) return
    void createTaskTodo(taskId, t)
    setTodoDraft('')
  }

  return (
    <form onSubmit={onSave}>
      <div className="fg">
        <div className="ff fg-full"><label>Titulo</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
        <div className="ff fg-full"><label>Descricao</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhe a tarefa..." /></div>
        <div className="ff"><label>Etapa</label>
          <select value={stageId} onChange={(e) => setStageId(e.target.value)}>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="ff"><label>Prazo</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        <div className="ff"><label>Responsavel</label>
          <input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nome" /></div>
        <div className="ff"><label>Tempo manual (min)</label>
          <input type="number" min="0" value={manualMinutes}
            onChange={(e) => setManualMinutes(Number(e.target.value || 0))} /></div>
      </div>

      <div className="kb-timer-row">
        <span className="kb-timer-display">{formatDuration(liveSeconds)}</span>
        <button type="button"
          className={`timer-btn ${task.timerStartedAt ? 'stop' : 'play'}`}
          onClick={() => task.timerStartedAt ? void stopTaskTimer(taskId) : void startTaskTimer(taskId)}>
          {task.timerStartedAt
            ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pausar</>
            : <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Iniciar</>}
        </button>
      </div>

      <div className="kb-todo-section">
        <div className="kb-todo-header">
          <span>Sub-Tarefas</span>
          <span className="badge badge-purple">{todos.filter((t) => t.done).length}/{todos.length}</span>
        </div>
        <div className="kb-todo-add">
          <input value={todoDraft} onChange={(e) => setTodoDraft(e.target.value)}
            placeholder="Adicionar item..."
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTodo() }}} />
          <button type="button" className="btn btn-primary btn-sm" onClick={addTodo}>+</button>
        </div>
        <ul className="kb-todo-list">
          {todos.map((todo) => (
            <li key={todo.id} className="kb-todo-item">
              <input type="checkbox" checked={todo.done} onChange={() => void toggleTaskTodo(todo.id)} />
              <span className={todo.done ? 'kb-todo-done' : ''}>{todo.title}</span>
              <button type="button" className="kb-todo-remove" onClick={() => void deleteTaskTodo(todo.id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-danger btn-sm" onClick={() => {
          if (window.confirm('Tem certeza que deseja excluir esta tarefa?')) {
            void deleteTask(taskId)
            onDone()
          }
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Excluir
        </button>
        <button type="submit" className="btn btn-primary">Salvar alteracoes</button>
      </div>
    </form>
  )
}

function CreateTaskInProject({ projectId, stages, onDone }: {
  projectId: string
  stages: ProjectStage[]
  onDone: () => void
}) {
  const { createTask, createTaskTodo } = useAppData()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stageId, setStageId] = useState(stages[0]?.id ?? '')
  const [dueDate, setDueDate] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'))
  const [responsible, setResponsible] = useState('')
  const [manualMinutes, setManualMinutes] = useState(0)
  const [todoDrafts, setTodoDrafts] = useState<string[]>([])
  const [todoInput, setTodoInput] = useState('')

  const addTodo = () => {
    if (!todoInput.trim()) return
    setTodoDrafts((c) => [...c, todoInput.trim()])
    setTodoInput('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !stageId) return
    const newId = await createTask({
      title: title.trim(), description: description.trim(), dueDate,
      responsible: responsible.trim(), manualMinutes,
      projectId, stageId, attachments: [],
    })
    for (const t of todoDrafts) await createTaskTodo(newId, t)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="fg">
        <div className="ff fg-full"><label>Titulo *</label>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome da tarefa" required /></div>
        <div className="ff fg-full"><label>Descricao</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhe a tarefa..." /></div>
        <div className="ff"><label>Etapa *</label>
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} required>
            {stages.length === 0 && <option value="">Crie etapas no Kanban</option>}
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="ff"><label>Prazo</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        <div className="ff"><label>Responsavel</label>
          <input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nome" /></div>
        <div className="ff"><label>Tempo manual (min)</label>
          <input type="number" min="0" value={manualMinutes} onChange={(e) => setManualMinutes(Number(e.target.value || 0))} /></div>
      </div>

      <div className="kb-todo-section">
        <div className="kb-todo-header">
          <span>Sub-Tarefas</span>
          <span className="badge badge-purple">{todoDrafts.length}</span>
        </div>
        <div className="kb-todo-add">
          <input value={todoInput} onChange={(e) => setTodoInput(e.target.value)}
            placeholder="Adicionar item..."
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTodo() }}} />
          <button type="button" className="btn btn-primary btn-sm" onClick={addTodo}>+</button>
        </div>
        {todoDrafts.length > 0 && (
          <ul className="kb-todo-list">
            {todoDrafts.map((t, i) => (
              <li key={i} className="kb-todo-item">
                <span>{t}</span>
                <button type="button" className="kb-todo-remove" onClick={() => setTodoDrafts((c) => c.filter((_, j) => j !== i))}>x</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="modal-footer">
        <button type="submit" className="btn btn-primary" disabled={!stageId}>Criar tarefa</button>
      </div>
    </form>
  )
}
