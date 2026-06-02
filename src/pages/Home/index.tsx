import dayjs from 'dayjs'
import { useAppData } from '../../context/AppDataContext'
import './style.css'

const statCards = [
  {
    key: 'totalProjects',
    label: 'Projetos',
    colorClass: '',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/>
      </svg>
    ),
  },
  {
    key: 'completedTodoItems',
    label: 'Tarefas concluídas',
    colorClass: 'green',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    ),
  },
  {
    key: 'inProgressTasks',
    label: 'Em andamento',
    colorClass: 'amber',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    key: 'doneTasks',
    label: 'Finalizadas',
    colorClass: 'purple',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M9 11l3 3 4-4"/>
      </svg>
    ),
  },
  {
    key: 'lateTasks',
    label: 'Atrasadas',
    colorClass: 'danger',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
] as const

export default function HomePage() {
  const { dashboardStats, projects, tasks, usingSupabase } = useAppData()

  return (
    <section className="home-page">
      <div className="home-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral dos seus projetos e tarefas</p>
        </div>
        <span className="status-pill">
          {usingSupabase ? 'Conectado ao Supabase' : 'Modo local'}
        </span>
      </div>

      <div className="stats-grid">
        {statCards.map(({ key, label, colorClass, icon }) => (
          <article className={`stat-card${colorClass ? ` ${colorClass}` : ''}`} key={key}>
            <div className="stat-icon">{icon}</div>
            <span>{label}</span>
            <strong>{dashboardStats[key]}</strong>
          </article>
        ))}
      </div>

      <div className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Projetos recentes</h2>
            <span className="count-badge">{projects.length}</span>
          </div>
          <div className="panel-body">
            {projects.length === 0 ? (
              <p className="panel-empty">Nenhum projeto cadastrado.</p>
            ) : (
              projects.slice(0, 6).map((project) => (
                <div className="panel-row" key={project.id}>
                  <strong>{project.name}</strong>
                  <span className="date-chip">{dayjs(project.dueDate).format('DD/MM/YY')}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Vencimentos próximos</h2>
            <span className="count-badge">{tasks.length}</span>
          </div>
          <div className="panel-body">
            {tasks.length === 0 ? (
              <p className="panel-empty">Nenhuma tarefa cadastrada.</p>
            ) : (
              tasks
                .slice()
                .sort((a, b) => dayjs(a.dueDate).unix() - dayjs(b.dueDate).unix())
                .slice(0, 6)
                .map((task) => (
                  <div className="panel-row" key={task.id}>
                    <strong>{task.title}</strong>
                    <span className="date-chip">{dayjs(task.dueDate).format('DD/MM/YY')}</span>
                  </div>
                ))
            )}
          </div>
        </article>
      </div>
    </section>
  )
}

