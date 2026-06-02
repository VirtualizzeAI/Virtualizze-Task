import { useMemo, useState, type FormEvent } from 'react'
import dayjs from 'dayjs'
import { useAppData } from '../../context/AppDataContext'
import type { Task } from '../../types/domain'
import { Modal } from '../../components/Modal'
import './style.css'

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

function TaskDetailModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const {
    tasks, projects, stages, taskTodos, updateTaskFull, updateTaskStatus, updateTaskManualMinutes,
    startTaskTimer, stopTaskTimer, createTaskTodo, toggleTaskTodo,
  } = useAppData()

  const task = tasks.find((t) => t.id === taskId)

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [responsible, setResponsible] = useState(task?.responsible ?? '')
  const [stageId, setStageId] = useState(task?.stageId ?? '')
  const [manualMinutes, setManualMinutes] = useState(task?.manualMinutes ?? 0)
  const [todoDraft, setTodoDraft] = useState('')

  const projectStages = stages.filter((s) => s.projectId === task?.projectId)
  const todos = taskTodos.filter((t) => t.taskId === taskId)
  const projectName = projects.find((p) => p.id === task?.projectId)?.name

  // Live timer — re-computes every time tasks state updates (context ticks every second)
  const liveSeconds = useMemo(() => {
    if (!task) return 0
    if (!task.timerStartedAt) return task.trackedSeconds
    return task.trackedSeconds + Math.max(0, dayjs().diff(dayjs(task.timerStartedAt), 'second'))
  }, [task])

  const stageToStatus = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes('final') || n.includes('done') || n.includes('conclu')) return 'done' as const
    if (n.includes('andamento') || n.includes('doing') || n.includes('progress')) return 'in_progress' as const
    return 'todo' as const
  }

  if (!task) return null

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    await updateTaskFull(taskId, { title, description, dueDate, responsible, stageId, manualMinutes })
    if (stageId !== task.stageId) {
      const selectedStage = projectStages.find((s) => s.id === stageId)
      const newStatus = selectedStage ? stageToStatus(selectedStage.name) : task.status
      await updateTaskStatus(taskId, newStatus, stageId)
    } else if (manualMinutes !== task.manualMinutes) {
      await updateTaskManualMinutes(taskId, manualMinutes)
    }
    onClose()
  }

  const addTodo = () => {
    const t = todoDraft.trim()
    if (!t) return
    void createTaskTodo(taskId, t)
    setTodoDraft('')
  }

  return (
    <form onSubmit={onSave}>
      {projectName && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Projeto: <strong style={{ color: 'var(--brand)' }}>{projectName}</strong></p>}
      <div className="fg">
        <div className="ff fg-full"><label>Titulo</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
        <div className="ff fg-full"><label>Descricao</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhe a tarefa..." /></div>
        <div className="ff"><label>Etapa</label>
          <select value={stageId} onChange={(e) => setStageId(e.target.value)}>
            {projectStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="ff"><label>Prazo</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        <div className="ff"><label>Responsavel</label>
          <input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nome" /></div>
        <div className="ff"><label>Tempo manual (min)</label>
          <input type="number" min="0" value={manualMinutes}
            onChange={(e) => setManualMinutes(Number(e.target.value || 0))} /></div>
      </div>

      <div className="task-detail-timer">
        <span className="task-timer-display">{formatDuration(liveSeconds)}</span>
        <button type="button"
          className={`timer-btn ${task.timerStartedAt ? 'stop' : 'play'}`}
          onClick={() => task.timerStartedAt ? void stopTaskTimer(taskId) : void startTaskTimer(taskId)}>
          {task.timerStartedAt
            ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pausar</>
            : <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Iniciar</>}
        </button>
      </div>

      <div className="task-detail-todos">
        <div className="td-header">
          <span>To-do list</span>
          <span className="badge badge-purple">{todos.filter((t) => t.done).length}/{todos.length}</span>
        </div>
        {todos.length > 0 && (
          <div className="td-progress">
            <div className="progress-wrap"><div className="progress-fill green" style={{ width: `${todos.length === 0 ? 0 : Math.round((todos.filter((t) => t.done).length / todos.length) * 100)}%` }} /></div>
          </div>
        )}
        <div className="td-add">
          <input value={todoDraft} onChange={(e) => setTodoDraft(e.target.value)} placeholder="Adicionar item..."
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTodo() }}} />
          <button type="button" className="btn btn-primary btn-sm" onClick={addTodo}>+</button>
        </div>
        <ul className="td-list">
          {todos.map((todo) => (
            <li key={todo.id} className="td-item">
              <input type="checkbox" checked={todo.done} onChange={() => void toggleTaskTodo(todo.id)} />
              <span className={todo.done ? 'td-done' : ''}>{todo.title}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="modal-footer">
        <button type="submit" className="btn btn-primary">Salvar alteracoes</button>
      </div>
    </form>
  )
}

export default function TasksPage() {
  const { tasks, projects, stages, taskTodos } = useAppData()
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const orderedTasks = useMemo(() => {
    let list = tasks.slice().sort((a, b) => dayjs(b.createdAt).unix() - dayjs(a.createdAt).unix())
    if (filterProject) list = list.filter((t) => t.projectId === filterProject)
    if (filterStatus) list = list.filter((t) => t.status === filterStatus)
    return list
  }, [tasks, filterProject, filterStatus])

  const getProject = (pid: string) => projects.find((p) => p.id === pid)
  const getStage = (sid: string) => stages.find((s) => s.id === sid)

  const getTodoProgress = (taskId: string) => {
    const todos = taskTodos.filter((t) => t.taskId === taskId)
    if (todos.length === 0) return null
    const done = todos.filter((t) => t.done).length
    return { done, total: todos.length, pct: Math.round((done / todos.length) * 100) }
  }

  const isLate = (task: Task) => task.status !== 'done' && dayjs(task.dueDate).isBefore(dayjs(), 'day')

  const statusLabel = (status: string) => {
    if (status === 'done') return <span className="status-badge status-done">Concluida</span>
    if (status === 'in_progress') return <span className="status-badge status-in-progress">Em andamento</span>
    return <span className="status-badge status-todo">A fazer</span>
  }

  const detailTask = detailTaskId ? tasks.find((t) => t.id === detailTaskId) : null

  return (
    <section className="tasks-list-page">
      <div className="pg-header">
        <div className="pg-header-left">
          <h1>Tarefas</h1>
          <p>{orderedTasks.length} tarefa{orderedTasks.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="task-filters">
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
              <option value="">Todos projetos</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Todos status</option>
              <option value="todo">A fazer</option>
              <option value="in_progress">Em andamento</option>
              <option value="done">Concluida</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova tarefa
          </button>
        </div>
      </div>

      {orderedTasks.length === 0 ? (
        <div className="task-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <p>Nenhuma tarefa encontrada. Crie tarefas pelo Kanban ou adicione direto por la.</p>
        </div>
      ) : (
        <div className="task-list-card">
          <div className="task-list-header">
            <span>Tarefa</span><span>Projeto / Etapa</span><span>To-do</span><span>Prazo</span><span>Status</span>
          </div>
          {orderedTasks.map((task) => {
            const project = getProject(task.projectId)
            const stage = getStage(task.stageId)
            const todoProgress = getTodoProgress(task.id)
            const late = isLate(task)
            return (
              <button key={task.id} className="task-list-row" onClick={() => setDetailTaskId(task.id)}>
                <div className="task-row-name">
                  <strong>{task.title}</strong>
                  {task.description && <span className="task-row-desc">{task.description}</span>}
                  {task.responsible && <span className="task-row-resp">{task.responsible}</span>}
                </div>
                <div className="task-row-project">
                  {project && <span className="task-project-tag">{project.name}</span>}
                  {stage && <span className="task-stage-dot" style={{ background: stage.color }} />}
                  {stage && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{stage.name}</span>}
                </div>
                <div className="task-row-todo">
                  {todoProgress ? (
                    <>
                      <div className="progress-wrap" style={{ width: 70 }}>
                        <div className="progress-fill green" style={{ width: `${todoProgress.pct}%` }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{todoProgress.done}/{todoProgress.total}</span>
                    </>
                  ) : <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>}
                </div>
                <span className={`task-row-date ${late ? 'late' : ''}`}>{dayjs(task.dueDate).format('DD/MM/YY')}</span>
                <span>{statusLabel(task.status)}</span>
              </button>
            )
          })}
        </div>
      )}

      {detailTaskId && (
        <Modal title={detailTask?.title ?? 'Tarefa'} onClose={() => setDetailTaskId(null)} size="lg">
          <TaskDetailModal taskId={detailTaskId} onClose={() => setDetailTaskId(null)} />
        </Modal>
      )}

      {showCreate && (
        <Modal title="Nova tarefa" onClose={() => setShowCreate(false)} size="md">
          <CreateTaskForm
            projects={projects}
            stages={stages}
            onDone={() => setShowCreate(false)}
          />
        </Modal>
      )}
    </section>
  )
}

function CreateTaskForm({ projects, stages, onDone }: {
  projects: { id: string; name: string }[]
  stages: { id: string; projectId: string; name: string }[]
  onDone: () => void
}) {
  const { createTask, createTaskTodo } = useAppData()
  const [ntTitle, setNtTitle] = useState('')
  const [ntDescription, setNtDescription] = useState('')
  const [ntProjectId, setNtProjectId] = useState(projects[0]?.id ?? '')
  const [ntStageId, setNtStageId] = useState(() => stages.find((s) => s.projectId === projects[0]?.id)?.id ?? '')
  const [ntDueDate, setNtDueDate] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'))
  const [ntResponsible, setNtResponsible] = useState('')
  const [ntManualMinutes, setNtManualMinutes] = useState(0)
  const [ntTodoDrafts, setNtTodoDrafts] = useState<string[]>([])
  const [ntTodoInput, setNtTodoInput] = useState('')

  const ntStages = stages.filter((s) => s.projectId === ntProjectId)

  const handleProjectChange = (pid: string) => {
    setNtProjectId(pid)
    setNtStageId(stages.find((s) => s.projectId === pid)?.id ?? '')
  }

  const addNtTodo = () => {
    if (!ntTodoInput.trim()) return
    setNtTodoDrafts((c) => [...c, ntTodoInput.trim()])
    setNtTodoInput('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ntTitle.trim() || !ntProjectId || !ntStageId) return
    const newId = await createTask({
      title: ntTitle.trim(), description: ntDescription.trim(), dueDate: ntDueDate,
      responsible: ntResponsible.trim(), manualMinutes: ntManualMinutes,
      projectId: ntProjectId, stageId: ntStageId, attachments: [],
    })
    for (const t of ntTodoDrafts) await createTaskTodo(newId, t)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="fg">
        <div className="ff fg-full"><label>Titulo *</label>
          <input autoFocus value={ntTitle} onChange={(e) => setNtTitle(e.target.value)} placeholder="Nome da tarefa" required /></div>
        <div className="ff fg-full"><label>Descricao</label>
          <textarea value={ntDescription} onChange={(e) => setNtDescription(e.target.value)} placeholder="Detalhe a tarefa..." /></div>
        <div className="ff"><label>Projeto *</label>
          <select value={ntProjectId} onChange={(e) => handleProjectChange(e.target.value)} required>
            {projects.length === 0 && <option value="">Nenhum projeto</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div className="ff"><label>Etapa *</label>
          <select value={ntStageId} onChange={(e) => setNtStageId(e.target.value)} required>
            {ntStages.length === 0 && <option value="">Crie etapas no Kanban</option>}
            {ntStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="ff"><label>Prazo</label>
          <input type="date" value={ntDueDate} onChange={(e) => setNtDueDate(e.target.value)} /></div>
        <div className="ff"><label>Responsavel</label>
          <input value={ntResponsible} onChange={(e) => setNtResponsible(e.target.value)} placeholder="Nome" /></div>
        <div className="ff"><label>Tempo manual (min)</label>
          <input type="number" min="0" value={ntManualMinutes} onChange={(e) => setNtManualMinutes(Number(e.target.value || 0))} /></div>
      </div>

      <div className="kb-todo-section">
        <div className="kb-todo-header">
          <span>To-do list</span>
          <span className="badge badge-purple">{ntTodoDrafts.length}</span>
        </div>
        <div className="kb-todo-add">
          <input value={ntTodoInput} onChange={(e) => setNtTodoInput(e.target.value)}
            placeholder="Adicionar item..."
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNtTodo() }}} />
          <button type="button" className="btn btn-primary btn-sm" onClick={addNtTodo}>+</button>
        </div>
        {ntTodoDrafts.length > 0 && (
          <ul className="kb-todo-list">
            {ntTodoDrafts.map((t, i) => (
              <li key={i} className="kb-todo-item">
                <span>{t}</span>
                <button type="button" className="kb-todo-remove" onClick={() => setNtTodoDrafts((c) => c.filter((_, j) => j !== i))}>x</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="modal-footer">
        <button type="submit" className="btn btn-primary" disabled={!ntProjectId || !ntStageId}>Criar tarefa</button>
      </div>
    </form>
  )
}
