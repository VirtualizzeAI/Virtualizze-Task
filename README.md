# Virtualizze Task Manager

Sistema simples de gestao de projetos e tarefas com:

- Dashboard com contadores de projetos e tarefas
- Gestao de Projetos (nome, descricao, prazo, valor, responsaveis, cliente, anexos)
- Quadro Kanban por projeto com etapas personalizaveis (nome e cor)
- Gestao de Tarefas (titulo, descricao, prazo, responsavel, tempo manual, cronometro play/stop, anexos, to-do list por tarefa)
- Pagina de Clientes (nome, contato, email, descricao, projetos associados, anexos)
- Layout responsivo (mobile e desktop)
- PWA com service worker e manifesto
- Integracao com Supabase (com fallback local quando variaveis de ambiente nao estao configuradas)

## Arquitetura de pastas

```txt
src/
  app/
    App.tsx
    router.tsx
  components/
    Layout/
      index.tsx
      style.css
  context/
    AppDataContext.tsx
  pages/
    Home/
      index.tsx
      style.css
    Projects/
      index.tsx
      style.css
    Kanban/
      index.tsx
      style.css
    Tasks/
      index.tsx
      style.css
    Clients/
      index.tsx
      style.css
  services/
    supabase.ts
  types/
    domain.ts
```

## Como rodar

1. Instale dependencias:

```bash
npm install
```

2. Configure ambiente:

```bash
cp .env.example .env
```

3. Edite `.env` com URL e ANON KEY do Supabase.

4. Rode em desenvolvimento:

```bash
npm run dev
```

5. Build de producao:

```bash
npm run build
```

## Configuracao do Supabase

A configuracao completa esta em pasta separada:

- `supabase-setup/README.md`
- `supabase-setup/migrations/001_init_schema.sql`

## Observacoes

- Quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nao estao definidos, o app funciona em modo local (localStorage).
- Com Supabase configurado, o app usa as tabelas com RLS criadas na migration.
