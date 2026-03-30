-- ============================================================
-- FOLLOWUP AI — Schema base Supabase
-- Esegui questo per primo nell'SQL Editor di Supabase
-- ============================================================

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  email text not null,
  role text not null check (role in ('admin', 'manager', 'agent')),
  manager_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table public.contacts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  company text,
  email text,
  phone text,
  source text,
  stage text not null default 'new' check (stage in ('new', 'warm', 'hot', 'won', 'lost')),
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  contact_id uuid references public.contacts(id) on delete cascade,
  title text not null,
  task_type text check (task_type in ('chiamata', 'email', 'meeting', 'task')),
  due_date date,
  urgent boolean default false,
  completed boolean default false,
  completed_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  ai_generated boolean default false,
  notes text,
  created_at timestamptz default now()
);

create table public.voice_notes (
  id uuid default gen_random_uuid() primary key,
  contact_id uuid references public.contacts(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  transcript text,
  ai_analysis jsonb,
  audio_url text,
  created_at timestamptz default now()
);

create table public.activity_log (
  id uuid default gen_random_uuid() primary key,
  contact_id uuid references public.contacts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  payload jsonb,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.tasks enable row level security;
alter table public.voice_notes enable row level security;
alter table public.activity_log enable row level security;

create or replace function public.get_my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.get_my_agents()
returns setof uuid language sql security definer stable as $$
  select id from public.profiles where manager_id = auth.uid()
$$;

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function update_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Utente'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'agent')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profiles_select" on public.profiles for select using (
  id = auth.uid() or get_my_role() in ('admin', 'manager')
);
create policy "profiles_insert" on public.profiles for insert with check (
  get_my_role() = 'admin' or id = auth.uid()
);
create policy "profiles_update" on public.profiles for update using (
  id = auth.uid() or get_my_role() = 'admin'
);

create policy "contacts_select" on public.contacts for select using (
  get_my_role() = 'admin'
  or owner_id = auth.uid()
  or owner_id in (select get_my_agents())
);
create policy "contacts_insert" on public.contacts for insert with check (
  get_my_role() in ('admin', 'manager') or owner_id = auth.uid()
);
create policy "contacts_update" on public.contacts for update using (
  get_my_role() = 'admin'
  or owner_id = auth.uid()
  or owner_id in (select get_my_agents())
);
create policy "contacts_delete" on public.contacts for delete using (
  get_my_role() = 'admin'
);

create policy "tasks_select" on public.tasks for select using (
  get_my_role() = 'admin'
  or assigned_to = auth.uid()
  or assigned_to in (select get_my_agents())
  or created_by = auth.uid()
);
create policy "tasks_insert" on public.tasks for insert with check (
  get_my_role() in ('admin', 'manager') or created_by = auth.uid()
);
create policy "tasks_update" on public.tasks for update using (
  get_my_role() = 'admin'
  or assigned_to = auth.uid()
  or created_by = auth.uid()
  or assigned_to in (select get_my_agents())
);

create policy "voice_select" on public.voice_notes for select using (
  get_my_role() = 'admin'
  or created_by = auth.uid()
  or created_by in (select get_my_agents())
);
create policy "voice_insert" on public.voice_notes for insert with check (true);

create policy "activity_select" on public.activity_log for select using (
  get_my_role() in ('admin', 'manager') or user_id = auth.uid()
);
create policy "activity_insert" on public.activity_log for insert with check (true);
