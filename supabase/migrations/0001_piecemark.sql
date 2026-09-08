-- PieceMark — steel drawings control. Supabase schema v1.
--
-- Every record the app keeps is a row: `id` is the app's own id (e.g. dwg-…),
-- `data` is the full JSON record the frontend already models, and a few
-- columns are lifted out of it for indexing/reporting. All rows are owned by
-- the signed-in user (`user_id`) and locked down with RLS: a user can only
-- read or write their own rows. Files live in the private `sheets` bucket
-- under `<user_id>/<drawing_id>/…`.
--
-- Applied to project abbeavtbifuddtrifvae as migrations
-- `reset_public_for_piecemark`, `piecemark_core`, `piecemark_harden_set_updated_at`.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── per-user settings (station role, company profile) ──────────────────────
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  crew_role text not null default 'detailer',
  org_name text not null default '',
  org_rfi_email text not null default '',
  session_actor text not null default 'Station',
  selected_project_id text,
  updated_at timestamptz not null default now()
);

-- ── domain tables ───────────────────────────────────────────────────────────
create table public.projects (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_number text not null default '',
  name text not null default '',
  status text not null default 'detailing',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.sequences (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.drawing_sets (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  code text not null default '',
  status text not null default 'draft',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.drawings (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  set_id text not null,
  number text not null default '',
  status text not null default 'draft',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.revisions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  drawing_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.rfis (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  number text not null default '',
  status text not null default 'open',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.submittals (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  number text not null default '',
  status text not null default 'draft',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.markups (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  drawing_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.transmittals (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  number text not null default '',
  status text not null default 'draft',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.activities (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  at timestamptz not null default now(),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- PM tracker (kept in the port: same persistence adapter, five more tables)
create table public.tasks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  status text not null default 'open',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.change_orders (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  status text not null default 'draft',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.deliveries (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  status text not null default 'planned',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.work_packages (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  status text not null default 'not_started',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.roadblocks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  status text not null default 'open',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Title-block map: one per job per user (boxes for Title / Sheet no. / Rev)
create table public.title_block_maps (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

-- Uploaded sheet files: metadata row per drawing; bytes live in Storage
create table public.sheet_files (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  drawing_id text not null,
  name text not null,
  mime text not null,
  size_bytes bigint not null default 0,
  storage_path text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, drawing_id)
);

-- ── indexes ─────────────────────────────────────────────────────────────────
create index projects_user_idx      on public.projects (user_id);
create index sequences_user_proj    on public.sequences (user_id, project_id);
create index drawing_sets_user_proj on public.drawing_sets (user_id, project_id);
create index drawings_user_proj     on public.drawings (user_id, project_id);
create index drawings_user_set      on public.drawings (user_id, set_id);
create index drawings_user_status   on public.drawings (user_id, status);
create index revisions_user_dwg     on public.revisions (user_id, drawing_id);
create index rfis_user_proj         on public.rfis (user_id, project_id);
create index submittals_user_proj   on public.submittals (user_id, project_id);
create index markups_user_dwg       on public.markups (user_id, drawing_id);
create index transmittals_user_proj on public.transmittals (user_id, project_id);
create index activities_user_at     on public.activities (user_id, at desc);
create index tasks_user_proj        on public.tasks (user_id, project_id);
create index change_orders_user_proj on public.change_orders (user_id, project_id);
create index deliveries_user_proj   on public.deliveries (user_id, project_id);
create index work_packages_user_proj on public.work_packages (user_id, project_id);
create index roadblocks_user_proj   on public.roadblocks (user_id, project_id);

-- ── updated_at triggers + RLS (owner-only) on every table ───────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_settings','projects','sequences','drawing_sets','drawings','revisions',
    'rfis','submittals','markups','transmittals','activities','tasks',
    'change_orders','deliveries','work_packages','roadblocks',
    'title_block_maps','sheet_files']
  LOOP
    EXECUTE format('create trigger %I_touch before update on public.%I for each row execute function public.set_updated_at()', t, t);
    EXECUTE format('alter table public.%I enable row level security', t);
    EXECUTE format('create policy %I_owner_select on public.%I for select to authenticated using (user_id = auth.uid())', t, t);
    EXECUTE format('create policy %I_owner_insert on public.%I for insert to authenticated with check (user_id = auth.uid())', t, t);
    EXECUTE format('create policy %I_owner_update on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    EXECUTE format('create policy %I_owner_delete on public.%I for delete to authenticated using (user_id = auth.uid())', t, t);
  END LOOP;
END $$;

-- ── Storage: private bucket for sheet PDFs/images, owner-only by path prefix ─
insert into storage.buckets (id, name, public, file_size_limit)
values ('sheets', 'sheets', false, 104857600)
on conflict (id) do nothing;

create policy "sheets owner select" on storage.objects for select to authenticated
  using (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sheets owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sheets owner update" on storage.objects for update to authenticated
  using (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sheets owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);
