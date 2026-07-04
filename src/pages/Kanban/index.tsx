import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppData } from '../../context/AppDataContext'
import type { Task, TaskStatus, ProjectStage } from '../../types/domain'
import { Modal } from '../../components/Modal'
import './style.css'

const stageToStatus = (stageName: string): TaskStatus => {
  const n = stageName.toLowerCase()
  if (n.includes('final') || n.includes('done') || n.includes('conclu')) return 'done'
  if (n.includes('andamento') || n.includes('doing') || n.includes('progress')) return 'in_progress'
  return 'todo'
}

/* ── Draggable task card ── */
function DraggableCard({
  task,
  onClick,
}: {
  task: Task
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  const isLate = !task.timerStartedAt && dayjs(task.dueDate).isBefore(dayjs(), 'day') && task.status !== 'done'

  return (
    <div
      ref={setNodeRef}
      className={`kb-card ${isDragging ? 'kb-card-dragging' : ''}`}
      {...attributes}
    >
      <div className="kb-card-drag" {...listeners}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>
      <button className="kb-card-inner" onClick={onClick}>
        <span className="kb-card-title">{task.title}</span>
        {task.description && <span className="kb-card-desc">{task.description}</span>}
        <div className="kb-card-footer">
          <span className={`kb-card-date ${isLate ? 'late' : ''}`}>
            {isLate && <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>}
            {dayjs(task.dueDate).format('DD/MM')}
          </span>
          {task.responsible && (
            <span className="kb-card-avatar">{task.responsible[0]?.toUpperCase()}</span>
          )}
        </div>
      </button>
    </div>
  )
}

/* ── Card preview for DragOverlay ── */
function CardPreview({ task }: { task: Task }) {
  const isLate = !task.timerStartedAt && dayjs(task.dueDate).isBefore(dayjs(), 'day') && task.status !== 'done'
  return (
    <div className="kb-card kb-card-overlay">
      <div className="kb-card-drag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>
      <div className="kb-card-inner">
        <span className="kb-card-title">{task.title}</span>
        {task.description && <span className="kb-card-desc">{task.description}</span>}
        <div className="kb-card-footer">
          <span className={`kb-card-date ${isLate ? 'late' : ''}`}>{dayjs(task.dueDate).format('DD/MM')}</span>
          {task.responsible && <span className="kb-card-avatar">{task.responsible[0]?.toUpperCase()}</span>}
        </div>
      </div>
    </div>
  )
}

/* ── Droppable column ── */
function KanbanColumn({
  stage,
  tasks,
  onAddTask,
  onEditStage,
  onTaskClick,
}: {
  stage: ProjectStage
  tasks: Task[]
  onAddTask: () => void
  onEditStage: () => void
  onTaskClick: (task: Task) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id })

  return (
    <article className={`kb-column ${isOver ? 'kb-column-over' : ''}`}>
      <div className="kb-col-header">
        <div className="kb-col-title-row">
          <span className="kb-col-dot" style={{ background: stage.color }} />
          <button className="kb-col-name" onClick={onEditStage}>{stage.name}</button>
          <span className="kb-col-count">{tasks.length}</span>
        </div>
        <button className="kb-add-btn" onClick={onAddTask} title="Adicionar tarefa">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div className="kb-col-body" ref={setNodeRef}>
        {tasks.map((task) => (
          <DraggableCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
        ))}
      </div>
    </article>
  )
}

/* ── Task create form (full) ── */
function TaskQuickForm({
  projectId,
  defaultStageId,
  stages,
  onDone,
}: {
  projectId: string
  defaultStageId: string
  stages: ProjectStage[]
  onDone: () => void
}) {
  const { createTask, createTaskTodo } = useAppData()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stageId, setStageId] = useState(defaultStageId)
  const [dueDate, setDueDate] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'))
  const [responsible, setResponsible] = useState('')
  const [manualMinutes, setManualMinutes] = useState(0)
  const [todoDrafts, setTodoDrafts] = useState<string[]>([])
  const [todoDraftInput, setTodoDraftInput] = useState('')

  const addTodoDraft = () => {
    if (!todoDraftInput.trim()) return
    setTodoDrafts((c) => [...c, todoDraftInput.trim()])
    setTodoDraftInput('')
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const newId = await createTask({
      title: title.trim(), description: description.trim(), dueDate,
      responsible: responsible.trim(), manualMinutes, projectId, stageId,
      attachments: [],
    })
    for (const t of todoDrafts) await createTaskTodo(newId, t)
    onDone()
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="fg">
        <div className="ff fg-full"><label>Titulo *</label>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome da tarefa" required /></div>
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
          <input type="number" min="0" value={manualMinutes} onChange={(e) => setManualMinutes(Number(e.target.value || 0))} /></div>
      </div>

      <div className="kb-todo-section">
        <div className="kb-todo-header">
          <span>Sub-Tarefas</span>
          <span className="badge badge-purple">{todoDrafts.length}</span>
        </div>
        <div className="kb-todo-add">
          <input value={todoDraftInput} onChange={(e) => setTodoDraftInput(e.target.value)}
            placeholder="Adicionar item..."
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTodoDraft() }}} />
          <button type="button" className="btn btn-primary btn-sm" onClick={addTodoDraft}>+</button>
        </div>
        {todoDrafts.length > 0 && (
          <ul className="kb-todo-list">
            {todoDrafts.map((t, i) => (
              <li key={i} className="kb-todo-item">
                <span>{t}</span>
                <button type="button" className="kb-todo-remove" onClick={() => setTodoDrafts((c) => c.filter((_, j) => j !== i))}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="modal-footer"><button type="submit" className="btn btn-primary">Adicionar tarefa</button></div>
    </form>
  )
}

/* ── Task detail / edit form ── */
function TaskDetailForm({
  taskId,
  stages,
  onDone,
}: {
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

/* ── Stage edit form ── */
function StageEditForm({ stage, onDone, onDelete }: { stage: ProjectStage; onDone: () => void; onDelete: () => void }) {
  const { updateStage } = useAppData()
  const [name, setName] = useState(stage.name)
  const [color, setColor] = useState(stage.color)
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await updateStage(stage.id, name, color)
    onDone()
  }
  return (
    <form onSubmit={onSubmit}>
      <div className="fg">
        <div className="ff"><label>Nome da etapa</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="ff"><label>Cor</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 40, height: 36, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{color}</span>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Excluir
        </button>
        <button type="submit" className="btn btn-primary">Salvar etapa</button>
      </div>
    </form>
  )
}

/* ── New stage form ── */
function NewStageForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const { createStage } = useAppData()
  const [name, setStageName] = useState('')
  const [color, setColor] = useState('#5b6af8')
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await createStage(projectId, name.trim(), color)
    onDone()
  }
  return (
    <form onSubmit={onSubmit}>
      <div className="fg">
        <div className="ff"><label>Nome da etapa *</label>
          <input value={name} onChange={(e) => setStageName(e.target.value)} placeholder="Ex: QA, Revisao..." required /></div>
        <div className="ff"><label>Cor</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 40, height: 36, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{color}</span>
          </div>
        </div>
      </div>
      <div className="modal-footer"><button type="submit" className="btn btn-primary">Criar etapa</button></div>
    </form>
  )
}

/* ── Sortable stage item ── */
function SortableStageItem({
  stage,
  taskCount,
  onEdit,
  onDelete,
}: {
  stage: ProjectStage
  taskCount: number
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sm-stage-item"
    >
      <div className="sm-stage-drag" {...attributes} {...listeners}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>
      <span className="sm-stage-dot" style={{ background: stage.color }} />
      <span className="sm-stage-name">{stage.name}</span>
      <span className="sm-stage-count">{taskCount} tarefa{taskCount !== 1 ? 's' : ''}</span>
      <div className="sm-stage-actions">
        <button type="button" className="sm-action-btn" onClick={onEdit} title="Editar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button type="button" className="sm-action-btn sm-action-danger" onClick={onDelete} title="Excluir">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  )
}

/* ── Stages manager modal ── */
function StagesManager({ projectId, stages }: {
  projectId: string
  stages: ProjectStage[]
}) {
  const { tasks, createStage, updateStage, deleteStage, reorderStages } = useAppData()
  const [localStages, setLocalStages] = useState<ProjectStage[]>([...stages].sort((a, b) => a.order - b.order))
  useEffect(() => {
    setLocalStages((curr) => {
      const sorted = [...stages].sort((a, b) => a.order - b.order)
      if (sorted.length !== curr.length || sorted.some((s, i) => s.id !== curr[i]?.id)) return sorted
      return curr
    })
  }, [stages])
  const [editingStage, setEditingStage] = useState<ProjectStage | null>(null)
  const [showNewStage, setShowNewStage] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#5b6af8')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const getTaskCount = (stageId: string) => tasks.filter((t) => t.stageId === stageId).length

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localStages.findIndex((s) => s.id === active.id)
    const newIndex = localStages.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newStages = [...localStages]
    const [moved] = newStages.splice(oldIndex, 1)
    newStages.splice(newIndex, 0, moved)
    setLocalStages(newStages)
    reorderStages(newStages.map((s) => s.id))
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    await createStage(projectId, newName.trim(), newColor)
    setNewName('')
    setNewColor('#5b6af8')
    setShowNewStage(false)
  }

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingStage) return
    await updateStage(editingStage.id, editingStage.name, editingStage.color)
    setLocalStages((curr) =>
      curr.map((s) => (s.id === editingStage.id ? { ...s, name: editingStage.name, color: editingStage.color } : s)),
    )
    setEditingStage(null)
  }

  const handleDelete = async (stageId: string) => {
    const stage = localStages.find((s) => s.id === stageId)
    const count = getTaskCount(stageId)
    const msg = count > 0
      ? `A etapa "${stage?.name}" tem ${count} tarefa${count !== 1 ? 's' : ''}. As tarefas serao movidas para a primeira etapa disponivel. Deseja excluir?`
      : `Tem certeza que deseja excluir a etapa "${stage?.name}"?`
    if (!window.confirm(msg)) return
    await deleteStage(stageId)
    setLocalStages((curr) => {
      const filtered = curr.filter((s) => s.id !== stageId)
      return filtered.map((s, i) => ({ ...s, order: i + 1 }))
    })
  }

  return (
    <div className="stages-manager">
      {localStages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <p>Nenhuma etapa ainda. Crie a primeira abaixo.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={localStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="sm-stage-list">
              {localStages.map((stage) => (
                <SortableStageItem
                  key={stage.id}
                  stage={stage}
                  taskCount={getTaskCount(stage.id)}
                  onEdit={() => setEditingStage({ ...stage })}
                  onDelete={() => void handleDelete(stage.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editingStage && (
        <div className="sm-edit-form">
          <div className="sm-edit-header">Editar etapa</div>
          <form onSubmit={(e) => void handleUpdate(e)}>
            <div className="fg">
              <div className="ff"><label>Nome</label>
                <input value={editingStage.name} onChange={(e) => setEditingStage((c) => c ? { ...c, name: e.target.value } : c)} required /></div>
              <div className="ff"><label>Cor</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="color" value={editingStage.color} onChange={(e) => setEditingStage((c) => c ? { ...c, color: e.target.value } : c)} style={{ width: 40, height: 36, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="submit" className="btn btn-primary btn-sm">Salvar</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingStage(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {showNewStage ? (
        <div className="sm-new-form">
          <div className="sm-edit-header">Nova etapa</div>
          <form onSubmit={(e) => void handleCreate(e)}>
            <div className="fg">
              <div className="ff"><label>Nome *</label>
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: QA, Revisao..." required /></div>
              <div className="ff"><label>Cor</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 40, height: 36, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="submit" className="btn btn-primary btn-sm">Criar</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowNewStage(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: '0.75rem', width: '100%' }} onClick={() => setShowNewStage(true)}>
          + Nova etapa
        </button>
      )}
    </div>
  )
}

/* ── Main page ── */
export default function KanbanPage() {
  const navigate = useNavigate()
  const { projects, stages, tasks, updateTaskStatus, deleteStage } = useAppData()

  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? '')
  const [addTaskStageId, setAddTaskStageId] = useState<string | null>(null)
  const [editTaskId, setEditTaskId] = useState<string | null>(null)
  const [editStage, setEditStage] = useState<ProjectStage | null>(null)
  const [showNewStage, setShowNewStage] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [showStagesManager, setShowStagesManager] = useState(false)

  const projectStages = useMemo(
    () => stages.filter((s) => s.projectId === projectId).sort((a, b) => a.order - b.order),
    [projectId, stages],
  )

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === projectId),
    [projectId, tasks],
  )

  const progress = useMemo(() => {
    const done = projectTasks.filter((t) => t.status === 'done').length
    const total = projectTasks.length
    return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
  }, [projectTasks])

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
    <section className="kb-page">
      {/* Controls */}
      <div className="kb-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
          <select
            className="kb-project-select"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.length === 0 && <option value="">Crie um projeto</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {projectTasks.length > 0 && (
            <div className="kb-progress-row">
              <div className="progress-wrap" style={{ width: 120 }}>
                <div
                  className={`progress-fill ${progress.pct === 100 ? 'green' : progress.pct >= 50 ? 'amber' : ''}`}
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <span className="kb-progress-label">{progress.pct}% <span style={{ color: 'var(--text-muted)' }}>({progress.done}/{progress.total})</span></span>
            </div>
          )}
        </div>
        {projectId && (
          <button className="btn btn-outline btn-sm" onClick={() => setShowStagesManager(true)}>
            Gerenciar etapas
          </button>
        )}
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setAddTaskStageId(projectStages[0]?.id ?? '')}
          disabled={projectStages.length === 0}
        >
          + Nova tarefa
        </button>
      </div>

      {/* Board */}
      {projects.length === 0 ? (
        <div className="kb-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          <p>Nenhum projeto encontrado. Crie seu primeiro projeto para comecar!</p>
          <button className="btn btn-primary" onClick={() => navigate('/projects')}>
            Criar Primeiro Projeto
          </button>
        </div>
      ) : projectStages.length === 0 ? (
        <div className="kb-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="18" rx="2"/><rect x="14" y="3" width="7" height="18" rx="2"/></svg>
          <p>Sem etapas. Crie a primeira etapa acima.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="kb-board">
            {projectStages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                tasks={projectTasks.filter((t) => t.stageId === stage.id)}
                onAddTask={() => setAddTaskStageId(stage.id)}
                onEditStage={() => setEditStage(stage)}
                onTaskClick={(task) => setEditTaskId(task.id)}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTask ? <CardPreview task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modals */}
      {addTaskStageId && (
        <Modal title="Nova tarefa" onClose={() => setAddTaskStageId(null)} size="md">
          <TaskQuickForm
            projectId={projectId}
            defaultStageId={addTaskStageId}
            stages={projectStages}
            onDone={() => setAddTaskStageId(null)}
          />
        </Modal>
      )}

      {editTaskId && (() => {
        const t = tasks.find((tk) => tk.id === editTaskId)
        return (
          <Modal title={t?.title ?? 'Tarefa'} onClose={() => setEditTaskId(null)} size="lg">
            <TaskDetailForm taskId={editTaskId} stages={projectStages} onDone={() => setEditTaskId(null)} />
          </Modal>
        )
      })()}

      {editStage && (
        <Modal title="Editar etapa" onClose={() => setEditStage(null)} size="sm">
          <StageEditForm
            stage={editStage}
            onDone={() => setEditStage(null)}
            onDelete={() => {
              const taskCount = tasks.filter((t) => t.stageId === editStage.id).length
              const msg = taskCount > 0
                ? `A etapa "${editStage.name}" tem ${taskCount} tarefa${taskCount !== 1 ? 's' : ''}. As tarefas serao movidas para a primeira etapa disponivel. Deseja excluir?`
                : `Tem certeza que deseja excluir a etapa "${editStage.name}"?`
              if (window.confirm(msg)) {
                void deleteStage(editStage.id)
                setEditStage(null)
              }
            }}
          />
        </Modal>
      )}

      {showNewStage && (
        <Modal title="Nova etapa" onClose={() => setShowNewStage(false)} size="sm">
          <NewStageForm projectId={projectId} onDone={() => setShowNewStage(false)} />
        </Modal>
      )}

      {showStagesManager && (
        <Modal title="Gerenciar etapas" onClose={() => setShowStagesManager(false)} size="md">
          <StagesManager projectId={projectId} stages={projectStages} />
        </Modal>
      )}
    </section>
  )
}
