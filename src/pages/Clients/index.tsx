import { useMemo, useState, type FormEvent } from 'react'
import dayjs from 'dayjs'
import { useAppData } from '../../context/AppDataContext'
import type { Attachment, Client } from '../../types/domain'
import { Modal } from '../../components/Modal'
import './style.css'

const parseAttachment = (raw: string): Attachment[] =>
  raw.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ id: crypto.randomUUID(), name }))

interface ClientFormState {
  name: string; contact: string; email: string
  description: string; projectIds: string[]; attachments: string
}

const emptyClientForm = (): ClientFormState => ({
  name: '', contact: '', email: '', description: '', projectIds: [], attachments: '',
})

const clientToForm = (c: Client): ClientFormState => ({
  name: c.name, contact: c.contact, email: c.email,
  description: c.description, projectIds: c.projectIds,
  attachments: c.attachments.map((a) => a.name).join(', '),
})

function ClientForm({ initial, projects, onSubmit, submitLabel }: {
  initial: ClientFormState
  projects: { id: string; name: string }[]
  onSubmit: (f: ClientFormState) => void
  submitLabel: string
}) {
  const [f, setF] = useState(initial)
  const set = (key: keyof ClientFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((c) => ({ ...c, [key]: e.target.value }))

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(f) }}>
      <div className="fg">
        <div className="ff"><label>Nome *</label>
          <input value={f.name} onChange={set('name')} placeholder="Nome do cliente" required /></div>
        <div className="ff"><label>E-mail *</label>
          <input type="email" value={f.email} onChange={set('email')} placeholder="email@empresa.com" required /></div>
        <div className="ff"><label>Contato</label>
          <input value={f.contact} onChange={set('contact')} placeholder="Telefone ou cargo" /></div>
        <div className="ff"><label>Projetos associados</label>
          <select multiple value={f.projectIds}
            onChange={(e) => setF((c) => ({ ...c, projectIds: Array.from(e.target.selectedOptions).map((o) => o.value) }))}
            style={{ minHeight: 80 }}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div className="ff fg-full"><label>Descricao</label>
          <textarea value={f.description} onChange={set('description')} placeholder="Informacoes sobre o cliente..." /></div>
        <div className="ff fg-full"><label>Anexos (virgula)</label>
          <input value={f.attachments} onChange={set('attachments')} placeholder="contrato.pdf, briefing.docx" /></div>
      </div>
      <div className="modal-footer"><button type="submit" className="btn btn-primary">{submitLabel}</button></div>
    </form>
  )
}

export default function ClientsPage() {
  const { clients, projects, createClient, updateClient } = useAppData()
  const [showCreate, setShowCreate] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)

  const orderedClients = useMemo(
    () => clients.slice().sort((a, b) => dayjs(b.createdAt).unix() - dayjs(a.createdAt).unix()),
    [clients],
  )

  const handleCreate = async (f: ClientFormState) => {
    await createClient({
      name: f.name, contact: f.contact, email: f.email,
      description: f.description, projectIds: f.projectIds,
      attachments: parseAttachment(f.attachments),
    })
    setShowCreate(false)
  }

  const handleEdit = async (f: ClientFormState) => {
    if (!editClient) return
    await updateClient(editClient.id, {
      name: f.name, contact: f.contact, email: f.email,
      description: f.description, projectIds: f.projectIds,
      attachments: parseAttachment(f.attachments),
    })
    setEditClient(null)
  }

  const getProjectNames = (ids: string[]) =>
    ids.map((id) => projects.find((p) => p.id === id)?.name).filter(Boolean) as string[]

  return (
    <section className="clients-page">
      <div className="pg-header">
        <div className="pg-header-left">
          <h1>Clientes</h1>
          <p>{clients.length} cliente{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo cliente
        </button>
      </div>

      {orderedClients.length === 0 ? (
        <div className="client-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <p>Nenhum cliente ainda. Adicione o primeiro!</p>
        </div>
      ) : (
        <div className="client-list-card">
          <div className="client-list-header">
            <span>Cliente</span><span>Contato</span><span>Projetos</span>
          </div>
          {orderedClients.map((client) => {
            const pnames = getProjectNames(client.projectIds)
            return (
              <button key={client.id} className="client-list-row" onClick={() => setEditClient(client)}>
                <div className="client-row-info">
                  <div className="client-avatar">{client.name[0]?.toUpperCase()}</div>
                  <div>
                    <strong className="client-name">{client.name}</strong>
                    <span className="client-email">{client.email}</span>
                  </div>
                </div>
                <span className="client-row-contact">{client.contact || '—'}</span>
                <div className="client-row-projects">
                  {pnames.length > 0
                    ? pnames.map((n) => <span key={n} className="client-proj-tag">{n}</span>)
                    : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="Novo cliente" onClose={() => setShowCreate(false)} size="md">
          <ClientForm initial={emptyClientForm()} projects={projects} onSubmit={handleCreate} submitLabel="Criar cliente" />
        </Modal>
      )}

      {editClient && (
        <Modal title={editClient.name} onClose={() => setEditClient(null)} size="md">
          <ClientForm initial={clientToForm(editClient)} projects={projects} onSubmit={handleEdit} submitLabel="Salvar alteracoes" />
        </Modal>
      )}
    </section>
  )
}
