-- ============================================================
-- MIGRATION: Pipeline v2 — assigned_to per agente
-- Esegui nell'SQL Editor di Supabase
-- ============================================================

-- Aggiunge campo "assegnato a" (l'agente che gestisce l'opportunità)
alter table public.project_pipeline
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

-- Aggiorna la policy SELECT: admin/manager vedono tutto, agente vede solo i suoi
drop policy if exists "pipeline_select" on public.project_pipeline;
create policy "pipeline_select" on public.project_pipeline for select using (
  get_my_role() in ('admin', 'manager')
  or assigned_to = auth.uid()
);

-- Aggiorna la policy UPDATE: admin/manager possono aggiornare tutto, agente solo i suoi
drop policy if exists "pipeline_update" on public.project_pipeline;
create policy "pipeline_update" on public.project_pipeline for update using (
  get_my_role() in ('admin', 'manager')
  or assigned_to = auth.uid()
);
