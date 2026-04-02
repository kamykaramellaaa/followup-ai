-- ============================================================
-- MIGRATION: Aggiunta Projects + Miglioramenti Tasks
-- Esegui questo nell'SQL Editor di Supabase DOPO supabase-setup.sql
-- ============================================================

-- Tabella per i nuovi progetti (prodotti in sviluppo)
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  market text check (market in ('Retail', 'Horeca', 'Export', 'Interno')),
  stage text not null default 'idea' check (stage in ('idea', 'sviluppo', 'test', 'pronto')),
  priority text not null default 'media' check (priority in ('bassa', 'media', 'alta')),
  supplier text,
  weight_format text,
  cost_per_unit numeric,
  photo_url text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Migliora la tabella tasks aggiungendo colonne mancanti
alter table public.tasks add column if not exists priority text check (priority in ('bassa', 'media', 'alta')) default 'media';
alter table public.tasks add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.tasks rename column task_type to type;

-- Trigger per updated_at su projects
create trigger projects_updated_at
  before update on public.projects
  for each row execute function update_updated_at();

-- Row Level Security per projects
alter table public.projects enable row level security;

create policy "projects_select" on public.projects for select using (
  get_my_role() = 'admin'
  or owner_id = auth.uid()
  or owner_id in (select get_my_agents())
);

create policy "projects_insert" on public.projects for insert with check (
  get_my_role() in ('admin', 'manager')
);

create policy "projects_update" on public.projects for update using (
  get_my_role() = 'admin'
  or owner_id = auth.uid()
  or owner_id in (select get_my_agents())
);

create policy "projects_delete" on public.projects for delete using (
  get_my_role() = 'admin'
);
