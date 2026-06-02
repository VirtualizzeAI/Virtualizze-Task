-- Virtualizze Task Manager - Supabase initial schema
-- Run this file in Supabase SQL Editor or via supabase migration tooling.

create extension if not exists pgcrypto;

create type public.task_status as enum ('todo', 'in_progress', 'done');

create table if not exists public.clients (
  id bigserial primary key,
  owner_id uuid not null default auth.uid(),
  name text not null,
  contact text not null default '',
  email text not null,
  description text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id bigserial primary key,
  owner_id uuid not null default auth.uid(),
  name text not null,
  description text not null default '',
  due_date date not null,
  budget numeric(12,2) not null default 0,
  responsibles text[] not null default '{}',
  client_id bigint references public.clients(id) on delete set null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_stages (
  id bigserial primary key,
  owner_id uuid not null default auth.uid(),
  project_id bigint not null references public.projects(id) on delete cascade,
  name text not null,
  color text not null default '#355070',
  order_index integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id bigserial primary key,
  owner_id uuid not null default auth.uid(),
  project_id bigint not null references public.projects(id) on delete cascade,
  stage_id bigint not null references public.project_stages(id) on delete cascade,
  title text not null,
  description text not null default '',
  due_date date not null,
  responsible text not null default '',
  manual_minutes integer not null default 0,
  tracked_seconds integer not null default 0,
  timer_started_at timestamptz,
  status public.task_status not null default 'todo',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.task_todos (
  id bigserial primary key,
  owner_id uuid not null default auth.uid(),
  task_id bigint not null references public.tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.client_projects (
  id bigserial primary key,
  owner_id uuid not null default auth.uid(),
  client_id bigint not null references public.clients(id) on delete cascade,
  project_id bigint not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, project_id)
);

create index if not exists idx_projects_owner_id on public.projects(owner_id);
create index if not exists idx_projects_client_id on public.projects(client_id);
create index if not exists idx_project_stages_owner_id on public.project_stages(owner_id);
create index if not exists idx_project_stages_project_id on public.project_stages(project_id);
create index if not exists idx_tasks_owner_id on public.tasks(owner_id);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_stage_id on public.tasks(stage_id);
create index if not exists idx_task_todos_owner_id on public.task_todos(owner_id);
create index if not exists idx_task_todos_task_id on public.task_todos(task_id);
create index if not exists idx_clients_owner_id on public.clients(owner_id);
create index if not exists idx_client_projects_owner_id on public.client_projects(owner_id);
create index if not exists idx_client_projects_client_id on public.client_projects(client_id);
create index if not exists idx_client_projects_project_id on public.client_projects(project_id);

alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_stages enable row level security;
alter table public.tasks enable row level security;
alter table public.task_todos enable row level security;
alter table public.client_projects enable row level security;

create policy "clients_select_own" on public.clients
  for select using (owner_id = auth.uid());
create policy "clients_insert_own" on public.clients
  for insert with check (owner_id = auth.uid());
create policy "clients_update_own" on public.clients
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "clients_delete_own" on public.clients
  for delete using (owner_id = auth.uid());

create policy "projects_select_own" on public.projects
  for select using (owner_id = auth.uid());
create policy "projects_insert_own" on public.projects
  for insert with check (owner_id = auth.uid());
create policy "projects_update_own" on public.projects
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "projects_delete_own" on public.projects
  for delete using (owner_id = auth.uid());

create policy "stages_select_own" on public.project_stages
  for select using (owner_id = auth.uid());
create policy "stages_insert_own" on public.project_stages
  for insert with check (owner_id = auth.uid());
create policy "stages_update_own" on public.project_stages
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "stages_delete_own" on public.project_stages
  for delete using (owner_id = auth.uid());

create policy "tasks_select_own" on public.tasks
  for select using (owner_id = auth.uid());
create policy "tasks_insert_own" on public.tasks
  for insert with check (owner_id = auth.uid());
create policy "tasks_update_own" on public.tasks
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "tasks_delete_own" on public.tasks
  for delete using (owner_id = auth.uid());

create policy "todos_select_own" on public.task_todos
  for select using (owner_id = auth.uid());
create policy "todos_insert_own" on public.task_todos
  for insert with check (owner_id = auth.uid());
create policy "todos_update_own" on public.task_todos
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "todos_delete_own" on public.task_todos
  for delete using (owner_id = auth.uid());

create policy "client_projects_select_own" on public.client_projects
  for select using (owner_id = auth.uid());
create policy "client_projects_insert_own" on public.client_projects
  for insert with check (owner_id = auth.uid());
create policy "client_projects_update_own" on public.client_projects
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "client_projects_delete_own" on public.client_projects
  for delete using (owner_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

create policy "storage_read_own" on storage.objects
  for select using (bucket_id = 'task-attachments' and owner = auth.uid());
create policy "storage_insert_own" on storage.objects
  for insert with check (bucket_id = 'task-attachments' and owner = auth.uid());
create policy "storage_update_own" on storage.objects
  for update using (bucket_id = 'task-attachments' and owner = auth.uid());
create policy "storage_delete_own" on storage.objects
  for delete using (bucket_id = 'task-attachments' and owner = auth.uid());
