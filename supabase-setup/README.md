# Supabase Setup - Virtualizze Task Manager

Esta pasta contem tudo para configurar o Supabase do projeto.

## Estrutura

- `migrations/001_init_schema.sql`
  - Cria tabelas, enums, indices, foreign keys, sequences (`bigserial`), policies RLS e bucket de anexos.

## Como aplicar

1. Crie um projeto no Supabase.
2. No painel do projeto, abra **SQL Editor**.
3. Cole e execute o arquivo `migrations/001_init_schema.sql`.
4. Em **Authentication > Providers**, habilite o provedor de login desejado (email/senha, por exemplo).
5. Em **API Settings**, copie:
   - `Project URL`
   - `anon public key`
6. No frontend, preencha o arquivo `.env` a partir de `.env.example`.

## Tabelas criadas

- `clients`
- `projects`
- `project_stages`
- `tasks`
- `task_todos`
- `client_projects`

## Regras de seguranca (RLS)

- Todas as tabelas usam coluna `owner_id` com default `auth.uid()`.
- Policies garantem CRUD apenas para registros do usuario autenticado.
- Bucket `task-attachments` com policies por `owner`.

## Observacoes de anexos

- O schema inclui bucket privado `task-attachments` para armazenar arquivos reais.
- No frontend atual, os anexos sao cadastrados por nome no campo de texto para simplificar.
- Se quiser upload real, basta integrar `storage.from('task-attachments').upload(...)`.
