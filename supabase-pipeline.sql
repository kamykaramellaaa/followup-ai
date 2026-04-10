-- ============================================================
-- MIGRATION: Pipeline vendite per prodotto
-- Esegui nell'SQL Editor di Supabase
-- ============================================================

create table public.project_pipeline (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  contact_name text,         -- nome libero se non è un contatto registrato
  stage text not null default 'proposto'
    check (stage in ('proposto', 'campione', 'offerta', 'ordine')),
  notes text,
  value_estimate numeric,    -- valore stimato ordine (opzionale)
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger pipeline_updated_at
  before update on public.project_pipeline
  for each row execute function update_updated_at();

alter table public.project_pipeline enable row level security;

create policy "pipeline_select" on public.project_pipeline for select using (
  get_my_role() in ('admin', 'manager')
  or owner_id = auth.uid()
);

create policy "pipeline_insert" on public.project_pipeline for insert with check (
  get_my_role() in ('admin', 'manager')
);

create policy "pipeline_update" on public.project_pipeline for update using (
  get_my_role() = 'admin'
  or owner_id = auth.uid()
);

create policy "pipeline_delete" on public.project_pipeline for delete using (
  get_my_role() = 'admin'
  or owner_id = auth.uid()
);
