import { RouterProvider } from 'react-router-dom'
import { AppDataProvider } from '../context/AppDataContext'
import { router } from './router'

export default function App() {
  return (
    <AppDataProvider>
      <RouterProvider router={router} />
    </AppDataProvider>
  )
}
