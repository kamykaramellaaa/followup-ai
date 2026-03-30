-- ============================================================
-- FOLLOWUP AI — Modulo Progetti
-- Esegui DOPO supabase-setup.sql
-- ============================================================

create table public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'on_hold', 'completed', 'cancelled')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  due_date date,
  budget numeric(12,2),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.milestones (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  due_date date,
  completed boolean default false,
  completed_at timestamptz,
  sort_order int default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table public.project_contacts (
  project_id uuid references public.projects(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  role text,
  added_at timestamptz default now(),
  primary key (project_id, contact_id)
);

create table public.project_members (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member' check (role in ('owner', 'manager', 'member')),
  added_at timestamptz default now(),
  primary key (project_id, user_id)
);

create table public.project_notes (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete set null,
  content text not null,
  ai_summary text,
  ai_extracted_tasks jsonb,
  note_type text default 'update'
    check (note_type in ('update', 'meeting', 'call', 'decision', 'risk')),
  is_voice boolean default false,
  created_at timestamptz default now()
);

create table public.project_tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null,
  description text,
  task_type text check (task_type in ('chiamata', 'email', 'meeting', 'task', 'deliverable')),
  status text default 'todo' check (status in ('todo', 'in_progress', 'done', 'blocked')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  ai_generated boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function update_updated_at();

alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.project_contacts enable row level security;
alter table public.project_members enable row level security;
alter table public.project_notes enable row level security;
alter table public.project_tasks enable row level security;

create or replace function public.is_project_member(proj_id uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.project_members
    where project_id = proj_id and user_id = auth.uid()
  )
$$;

create policy "proj_select" on public.projects for select using (
  get_my_role() = 'admin'
  or owner_id = auth.uid()
  or is_project_member(id)
  or owner_id in (select get_my_agents())
);
create policy "proj_insert" on public.projects for insert with check (
  get_my_role() in ('admin', 'manager') or created_by = auth.uid()
);
create policy "proj_update" on public.projects for update using (
  get_my_role() = 'admin'
  or owner_id = auth.uid()
  or is_project_member(id)
);
create policy "proj_delete" on public.projects for delete using (
  get_my_role() = 'admin'
);

create policy "ms_all" on public.milestones for all using (
  get_my_role() = 'admin'
  or is_project_me
