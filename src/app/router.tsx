import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '../components/Layout'
import HomePage from '../pages/Home'
import ProjectsPage from '../pages/Projects'
import KanbanPage from '../pages/Kanban'
import TasksPage from '../pages/Tasks'
import ClientsPage from '../pages/Clients'
import AIPage from '../pages/AI'
import SettingsPage from '../pages/Settings'

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
      { path: 'ai', element: <AIPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
