import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import dayjs from 'dayjs'
import { isSupabaseConfigured, supabase } from '../services/supabase'
import type {
  AppData,
  Attachment,
  Client,
  DashboardStats,
  Project,
  ProjectStage,
  Task,
  TaskTodo,
  TaskStatus,
} from '../types/domain'

interface CreateProjectInput {
  name: string
  description: string
  dueDate: string
  budget: number
  responsibles: string[]
  clientId: string
  attachments: Attachment[]
}

interface CreateTaskInput {
  title: string
  description: string
  dueDate: string
  responsible: string
  manualMinutes: number
  projectId: string
  stageId: string
  attachments: Attachment[]
}

interface CreateClientInput {
  name: string
  contact: string
  email: string
  description: string
  projectIds: string[]
  attachments: Attachment[]
}

interface AppDataContextValue {
  isLoading: boolean
  usingSupabase: boolean
  projects: Project[]
  stages: ProjectStage[]
  tasks: Task[]
  taskTodos: TaskTodo[]
  clients: Client[]
  dashboardStats: DashboardStats
  createProject: (input: CreateProjectInput) => Promise<void>
  updateProject: (projectId: string, input: Partial<CreateProjectInput>) => Promise<void>
  createStage: (projectId: string, name: string, color: string) => Promise<void>
  updateStage: (stageId: string, name: string, color: string) => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<string>
  updateTaskFull: (taskId: string, input: Partial<CreateTaskInput>) => Promise<void>
  updateTaskStatus: (taskId: string, status: TaskStatus, stageId: string) => Promise<void>
  updateTaskManualMinutes: (taskId: string, manualMinutes: number) => Promise<void>
  startTaskTimer: (taskId: string) => Promise<void>
  stopTaskTimer: (taskId: string) => Promise<void>
  createTaskTodo: (taskId: string, title: string) => Promise<void>
  toggleTaskTodo: (todoId: string) => Promise<void>
  createClient: (input: CreateClientInput) => Promise<void>
  updateClient: (clientId: string, input: Partial<CreateClientInput>) => Promise<void>
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)

const STORAGE_KEY = 'virtualizze-task-data'

const defaultStages = (projectId: string): ProjectStage[] => [
  { id: crypto.randomUUID(), projectId, name: 'Backlog', color: '#355070', order: 1 },
  { id: crypto.randomUUID(), projectId, name: 'Em andamento', color: '#e09f3e', order: 2 },
  { id: crypto.randomUUID(), projectId, name: 'Finalizado', color: '#588157', order: 3 },
]

const fallbackData: AppData = {
  projects: [],
  stages: [],
  tasks: [],
  taskTodos: [],
  clients: [],
}

const toAttachmentArray = (value: unknown): Attachment[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => {
      const obj = item as Record<string, unknown>
      return {
        id: String(obj.id ?? crypto.randomUUID()),
        name: String(obj.name ?? 'Anexo'),
        url: obj.url ? String(obj.url) : undefined,
      }
    })
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [stages, setStages] = useState<ProjectStage[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskTodos, setTaskTodos] = useState<TaskTodo[]>([])
  const [clients, setClients] = useState<Client[]>([])

  const loadLocal = useCallback(() => {
    const localData = localStorage.getItem(STORAGE_KEY)
    if (!localData) {
      setProjects(fallbackData.projects)
      setStages(fallbackData.stages)
      setTasks(fallbackData.tasks)
      setTaskTodos(fallbackData.taskTodos)
      setClients(fallbackData.clients)
      return
    }

    const parsed = JSON.parse(localData) as AppData
    setProjects(parsed.projects ?? [])
    setStages(parsed.stages ?? [])
    setTasks(parsed.tasks ?? [])
    setTaskTodos(parsed.taskTodos ?? [])
    setClients(parsed.clients ?? [])
  }, [])

  const persistLocal = useCallback(
    (nextData: AppData) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData))
    },
    [],
  )

  const refreshFromSupabase = useCallback(async () => {
    if (!supabase) return

    const [
      projectsResult,
      stagesResult,
      tasksResult,
      todosResult,
      clientsResult,
      linksResult,
    ] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('project_stages').select('*').order('order_index', { ascending: true }),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('task_todos').select('*').order('id', { ascending: true }),
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('client_projects').select('*'),
    ])

    if (
      projectsResult.error ||
      stagesResult.error ||
      tasksResult.error ||
      todosResult.error ||
      clientsResult.error ||
      linksResult.error
    ) {
      throw new Error('Falha ao carregar dados do Supabase.')
    }

    const linkedProjects = (linksResult.data ?? []).reduce<Record<string, string[]>>((acc, row) => {
      const clientId = String(row.client_id)
      const projectId = String(row.project_id)
      if (!acc[clientId]) acc[clientId] = []
      acc[clientId].push(projectId)
      return acc
    }, {})

    setProjects(
      (projectsResult.data ?? []).map((row) => ({
        id: String(row.id),
        name: row.name,
        description: row.description,
        dueDate: row.due_date,
        budget: Number(row.budget ?? 0),
        responsibles: Array.isArray(row.responsibles) ? row.responsibles : [],
        clientId: row.client_id ? String(row.client_id) : '',
        attachments: toAttachmentArray(row.attachments),
        createdAt: row.created_at,
      })),
    )

    setStages(
      (stagesResult.data ?? []).map((row) => ({
        id: String(row.id),
        projectId: String(row.project_id),
        name: row.name,
        color: row.color,
        order: Number(row.order_index),
      })),
    )

    setTasks(
      (tasksResult.data ?? []).map((row) => ({
        id: String(row.id),
        projectId: String(row.project_id),
        stageId: String(row.stage_id),
        title: row.title,
        description: row.description,
        dueDate: row.due_date,
        responsible: row.responsible,
        manualMinutes: Number(row.manual_minutes ?? 0),
        trackedSeconds: Number(row.tracked_seconds ?? 0),
        timerStartedAt: row.timer_started_at,
        status: row.status,
        attachments: toAttachmentArray(row.attachments),
        createdAt: row.created_at,
      })),
    )

    setTaskTodos(
      (todosResult.data ?? []).map((row) => ({
        id: String(row.id),
        taskId: String(row.task_id),
        title: row.title,
        done: Boolean(row.done),
      })),
    )

    setClients(
      (clientsResult.data ?? []).map((row) => ({
        id: String(row.id),
        name: row.name,
        contact: row.contact,
        email: row.email,
        description: row.description,
        projectIds: linkedProjects[String(row.id)] ?? [],
        attachments: toAttachmentArray(row.attachments),
        createdAt: row.created_at,
      })),
    )
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        if (isSupabaseConfigured) {
          await refreshFromSupabase()
        } else {
          loadLocal()
        }
      } catch {
        loadLocal()
      } finally {
        setIsLoading(false)
      }
    }

    void run()
  }, [loadLocal, refreshFromSupabase])

  useEffect(() => {
    if (isSupabaseConfigured) return

    persistLocal({
      projects,
      stages,
      tasks,
      taskTodos,
      clients,
    })
  }, [clients, persistLocal, projects, stages, taskTodos, tasks])

  useEffect(() => {
    const interval = setInterval(() => {
      setTasks((current) =>
        current.map((task) => {
          if (!task.timerStartedAt) return task
          const diff = dayjs().diff(dayjs(task.timerStartedAt), 'second')
          if (diff <= 0) return task
          return {
            ...task,
            trackedSeconds: task.trackedSeconds + diff,
            timerStartedAt: dayjs().toISOString(),
          }
        }),
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      const now = dayjs().toISOString()
      if (supabase) {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            name: input.name,
            description: input.description,
            due_date: input.dueDate,
            budget: input.budget,
            responsibles: input.responsibles,
            client_id: input.clientId ? Number(input.clientId) : null,
            attachments: input.attachments,
          })
          .select('*')
          .single()

        if (error) throw error

        const projectId = String(data.id)
        let stagesToCreate = defaultStages(projectId)

        const { data: stageData, error: stageError } = await supabase
          .from('project_stages')
          .insert(
            stagesToCreate.map((stage) => ({
              project_id: Number(projectId),
              name: stage.name,
              color: stage.color,
              order_index: stage.order,
            })),
          )
          .select('*')

        if (stageError) throw stageError

        stagesToCreate = (stageData ?? []).map((row) => ({
          id: String(row.id),
          projectId: String(row.project_id),
          name: row.name,
          color: row.color,
          order: row.order_index,
        }))

        setProjects((curr) => [
          {
            id: projectId,
            name: data.name,
            description: data.description,
            dueDate: data.due_date,
            budget: Number(data.budget ?? 0),
            responsibles: Array.isArray(data.responsibles) ? data.responsibles : [],
            clientId: data.client_id ? String(data.client_id) : '',
            attachments: toAttachmentArray(data.attachments),
            createdAt: data.created_at,
          },
          ...curr,
        ])
        setStages((curr) => [...curr, ...stagesToCreate])

        return
      }

      const projectId = crypto.randomUUID()
      const projectStages = defaultStages(projectId)
      const project: Project = {
        id: projectId,
        name: input.name,
        description: input.description,
        dueDate: input.dueDate,
        budget: input.budget,
        responsibles: input.responsibles,
        clientId: input.clientId,
        attachments: input.attachments,
        createdAt: now,
      }

      setProjects((curr) => [project, ...curr])
      setStages((curr) => [...curr, ...projectStages])
    },
    [],
  )

  const createStage = useCallback(async (projectId: string, name: string, color: string) => {
    const stageOrder = stages.filter((stage) => stage.projectId === projectId).length + 1

    if (supabase) {
      const { data, error } = await supabase
        .from('project_stages')
        .insert({
          project_id: Number(projectId),
          name,
          color,
          order_index: stageOrder,
        })
        .select('*')
        .single()

      if (error) throw error

      setStages((curr) => [
        ...curr,
        {
          id: String(data.id),
          projectId: String(data.project_id),
          name: data.name,
          color: data.color,
          order: Number(data.order_index),
        },
      ])
      return
    }

    setStages((curr) => [
      ...curr,
      {
        id: crypto.randomUUID(),
        projectId,
        name,
        color,
        order: stageOrder,
      },
    ])
  }, [stages])

  const createTask = useCallback(async (input: CreateTaskInput): Promise<string> => {
    const now = dayjs().toISOString()

    if (supabase) {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: Number(input.projectId),
          stage_id: Number(input.stageId),
          title: input.title,
          description: input.description,
          due_date: input.dueDate,
          responsible: input.responsible,
          manual_minutes: input.manualMinutes,
          tracked_seconds: 0,
          timer_started_at: null,
          status: 'todo',
          attachments: input.attachments,
        })
        .select('*')
        .single()

      if (error) throw error

      const taskId = String(data.id)
      setTasks((curr) => [
        {
          id: taskId,
          projectId: String(data.project_id),
          stageId: String(data.stage_id),
          title: data.title,
          description: data.description,
          dueDate: data.due_date,
          responsible: data.responsible,
          manualMinutes: Number(data.manual_minutes ?? 0),
          trackedSeconds: Number(data.tracked_seconds ?? 0),
          timerStartedAt: data.timer_started_at,
          status: data.status,
          attachments: toAttachmentArray(data.attachments),
          createdAt: data.created_at,
        },
        ...curr,
      ])
      return taskId
    }

    const newId = crypto.randomUUID()
    setTasks((curr) => [
      {
        id: newId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        responsible: input.responsible,
        manualMinutes: input.manualMinutes,
        trackedSeconds: 0,
        timerStartedAt: null,
        attachments: input.attachments,
        createdAt: now,
        status: 'todo',
        projectId: input.projectId,
        stageId: input.stageId,
      },
      ...curr,
    ])
    return newId
  }, [])

  const updateTask = useCallback(async (taskId: string, partial: Partial<Task>) => {
    setTasks((curr) => curr.map((task) => (task.id === taskId ? { ...task, ...partial } : task)))

    if (supabase) {
      const payload: Record<string, unknown> = {}
      if (partial.title !== undefined) payload.title = partial.title
      if (partial.description !== undefined) payload.description = partial.description
      if (partial.dueDate !== undefined) payload.due_date = partial.dueDate
      if (partial.responsible !== undefined) payload.responsible = partial.responsible
      if (partial.attachments !== undefined) payload.attachments = partial.attachments
      if (partial.status !== undefined) payload.status = partial.status
      if (partial.stageId !== undefined) payload.stage_id = Number(partial.stageId)
      if (partial.manualMinutes !== undefined) payload.manual_minutes = partial.manualMinutes
      if (partial.trackedSeconds !== undefined) payload.tracked_seconds = partial.trackedSeconds
      if (partial.timerStartedAt !== undefined) payload.timer_started_at = partial.timerStartedAt
      await supabase.from('tasks').update(payload).eq('id', Number(taskId))
    }
  }, [])

  const updateTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus, stageId: string) => {
      await updateTask(taskId, { status, stageId })
    },
    [updateTask],
  )

  const updateTaskManualMinutes = useCallback(
    async (taskId: string, manualMinutes: number) => {
      await updateTask(taskId, { manualMinutes })
    },
    [updateTask],
  )

  const startTaskTimer = useCallback(
    async (taskId: string) => {
      await updateTask(taskId, { timerStartedAt: dayjs().toISOString() })
    },
    [updateTask],
  )

  const stopTaskTimer = useCallback(
    async (taskId: string) => {
      const target = tasks.find((task) => task.id === taskId)
      if (!target?.timerStartedAt) return
      const extraSeconds = dayjs().diff(dayjs(target.timerStartedAt), 'second')
      await updateTask(taskId, {
        trackedSeconds: target.trackedSeconds + Math.max(0, extraSeconds),
        timerStartedAt: null,
      })
    },
    [tasks, updateTask],
  )

  const createTaskTodo = useCallback(async (taskId: string, title: string) => {
    if (supabase) {
      const { data, error } = await supabase
        .from('task_todos')
        .insert({ task_id: Number(taskId), title, done: false })
        .select('*')
        .single()

      if (error) throw error

      setTaskTodos((curr) => [
        ...curr,
        {
          id: String(data.id),
          taskId: String(data.task_id),
          title: data.title,
          done: Boolean(data.done),
        },
      ])
      return
    }

    setTaskTodos((curr) => [
      ...curr,
      {
        id: crypto.randomUUID(),
        taskId,
        title,
        done: false,
      },
    ])
  }, [])

  const toggleTaskTodo = useCallback(
    async (todoId: string) => {
      let nextDone = false
      setTaskTodos((curr) =>
        curr.map((todo) => {
          if (todo.id !== todoId) return todo
          nextDone = !todo.done
          return { ...todo, done: !todo.done }
        }),
      )

      if (supabase) {
        await supabase.from('task_todos').update({ done: nextDone }).eq('id', Number(todoId))
      }
    },
    [],
  )

  const createClient = useCallback(async (input: CreateClientInput) => {
    const now = dayjs().toISOString()

    if (supabase) {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: input.name,
          contact: input.contact,
          email: input.email,
          description: input.description,
          attachments: input.attachments,
        })
        .select('*')
        .single()

      if (error) throw error
      const clientId = String(data.id)

      if (input.projectIds.length > 0) {
        const rows = input.projectIds.map((projectId) => ({
          client_id: Number(clientId),
          project_id: Number(projectId),
        }))
        await supabase.from('client_projects').insert(rows)
      }

      setClients((curr) => [
        {
          id: clientId,
          name: data.name,
          contact: data.contact,
          email: data.email,
          description: data.description,
          projectIds: input.projectIds,
          attachments: toAttachmentArray(data.attachments),
          createdAt: data.created_at,
        },
        ...curr,
      ])
      return
    }

    setClients((curr) => [
      {
        id: crypto.randomUUID(),
        name: input.name,
        contact: input.contact,
        email: input.email,
        description: input.description,
        projectIds: input.projectIds,
        attachments: input.attachments,
        createdAt: now,
      },
      ...curr,
    ])
  }, [])

  const updateProject = useCallback(async (projectId: string, input: Partial<CreateProjectInput>) => {
    setProjects((curr) =>
      curr.map((p) =>
        p.id === projectId
          ? {
              ...p,
              ...(input.name !== undefined && { name: input.name }),
              ...(input.description !== undefined && { description: input.description }),
              ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
              ...(input.budget !== undefined && { budget: input.budget }),
              ...(input.responsibles !== undefined && { responsibles: input.responsibles }),
              ...(input.clientId !== undefined && { clientId: input.clientId }),
              ...(input.attachments !== undefined && { attachments: input.attachments }),
            }
          : p,
      ),
    )
    if (supabase) {
      const payload: Record<string, unknown> = {}
      if (input.name !== undefined) payload.name = input.name
      if (input.description !== undefined) payload.description = input.description
      if (input.dueDate !== undefined) payload.due_date = input.dueDate
      if (input.budget !== undefined) payload.budget = input.budget
      if (input.responsibles !== undefined) payload.responsibles = input.responsibles
      if (input.clientId !== undefined) payload.client_id = input.clientId ? Number(input.clientId) : null
      if (input.attachments !== undefined) payload.attachments = input.attachments
      await supabase.from('projects').update(payload).eq('id', Number(projectId))
    }
  }, [])

  const updateStage = useCallback(async (stageId: string, name: string, color: string) => {
    setStages((curr) => curr.map((s) => (s.id === stageId ? { ...s, name, color } : s)))
    if (supabase) {
      await supabase.from('project_stages').update({ name, color }).eq('id', Number(stageId))
    }
  }, [])

  const updateTaskFull = useCallback(
    async (taskId: string, input: Partial<CreateTaskInput>) => {
      await updateTask(taskId, {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.responsible !== undefined && { responsible: input.responsible }),
        ...(input.manualMinutes !== undefined && { manualMinutes: input.manualMinutes }),
        ...(input.stageId !== undefined && { stageId: input.stageId }),
        ...(input.attachments !== undefined && { attachments: input.attachments }),
      })
    },
    [updateTask],
  )

  const updateClient = useCallback(async (clientId: string, input: Partial<CreateClientInput>) => {
    setClients((curr) =>
      curr.map((c) =>
        c.id === clientId
          ? {
              ...c,
              ...(input.name !== undefined && { name: input.name }),
              ...(input.contact !== undefined && { contact: input.contact }),
              ...(input.email !== undefined && { email: input.email }),
              ...(input.description !== undefined && { description: input.description }),
              ...(input.projectIds !== undefined && { projectIds: input.projectIds }),
              ...(input.attachments !== undefined && { attachments: input.attachments }),
            }
          : c,
      ),
    )
    if (supabase) {
      const payload: Record<string, unknown> = {}
      if (input.name !== undefined) payload.name = input.name
      if (input.contact !== undefined) payload.contact = input.contact
      if (input.email !== undefined) payload.email = input.email
      if (input.description !== undefined) payload.description = input.description
      if (input.attachments !== undefined) payload.attachments = input.attachments
      await supabase.from('clients').update(payload).eq('id', Number(clientId))
    }
  }, [])

  const dashboardStats = useMemo<DashboardStats>(() => {
    const now = dayjs()
    const inProgressTasks = tasks.filter((task) => task.status === 'in_progress').length
    const doneTasks = tasks.filter((task) => task.status === 'done').length
    const lateTasks = tasks.filter(
      (task) => task.status !== 'done' && dayjs(task.dueDate).isBefore(now, 'day'),
    ).length
    const completedTodoItems = taskTodos.filter((todo) => todo.done).length

    return {
      totalProjects: projects.length,
      inProgressTasks,
      doneTasks,
      lateTasks,
      completedTodoItems,
    }
  }, [projects.length, taskTodos, tasks])

  const value = useMemo<AppDataContextValue>(
    () => ({
      isLoading,
      usingSupabase: isSupabaseConfigured,
      projects,
      stages,
      tasks,
      taskTodos,
      clients,
      dashboardStats,
      createProject,
      updateProject,
      createStage,
      updateStage,
      createTask,
      updateTaskFull,
      updateTaskStatus,
      updateTaskManualMinutes,
      startTaskTimer,
      stopTaskTimer,
      createTaskTodo,
      toggleTaskTodo,
      createClient,
      updateClient,
    }),
    [
      clients,
      createClient,
      updateClient,
      createProject,
      updateProject,
      createStage,
      updateStage,
      createTask,
      updateTaskFull,
      createTaskTodo,
      dashboardStats,
      isLoading,
      projects,
      stages,
      startTaskTimer,
      stopTaskTimer,
      taskTodos,
      tasks,
      toggleTaskTodo,
      updateTaskManualMinutes,
      updateTaskStatus,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error('useAppData deve ser usado dentro de AppDataProvider')
  }
  return context
}
