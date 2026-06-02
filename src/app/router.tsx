import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '../components/Layout'
import HomePage from '../pages/Home'
import ProjectsPage from '../pages/Projects'
import KanbanPage from '../pages/Kanban'
import TasksPage from '../pages/Tasks'
import ClientsPage from '../pages/Clients'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'kanban', element: <KanbanPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'clients', element: <ClientsPage /> },
    ],
  },
])
