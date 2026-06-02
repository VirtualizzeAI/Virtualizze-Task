export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface Attachment {
  id: string
  name: string
  url?: string
}

export interface Project {
  id: string
  name: string
  description: string
  dueDate: string
  budget: number
  responsibles: string[]
  clientId: string
  attachments: Attachment[]
  createdAt: string
}

export interface ProjectStage {
  id: string
  projectId: string
  name: string
  color: string
  order: number
}

export interface TaskTodo {
  id: string
  taskId: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  projectId: string
  stageId: string
  title: string
  description: string
  dueDate: string
  responsible: string
  manualMinutes: number
  trackedSeconds: number
  timerStartedAt: string | null
  status: TaskStatus
  attachments: Attachment[]
  createdAt: string
}

export interface Client {
  id: string
  name: string
  contact: string
  email: string
  description: string
  projectIds: string[]
  attachments: Attachment[]
  createdAt: string
}

export interface DashboardStats {
  totalProjects: number
  inProgressTasks: number
  doneTasks: number
  lateTasks: number
  completedTodoItems: number
}

export interface AppData {
  projects: Project[]
  stages: ProjectStage[]
  tasks: Task[]
  taskTodos: TaskTodo[]
  clients: Client[]
}
