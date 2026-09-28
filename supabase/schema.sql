-- ============================================================================
-- AIIA TrialOps — PRODUCTION-PATH REFERENCE SCHEMA (Supabase / Postgres)
-- ----------------------------------------------------------------------------
-- This file documents the intended production architecture. It is NOT executed
-- by the local demo (the prototype runs in LOCAL DEMO MODE with an in-app
-- synthetic database). If Supabase credentials are configured, this schema +
-- RLS is the target state. Synthetic data only; no direct identifiers.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- Profiles mirror auth.users (Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('ADMIN','PI','COORDINATOR','MONITOR','PV_OFFICER','ETHICS_MEMBER','LEADERSHIP')),
  site_scope uuid[] not null default '{}'
);

create table public.trials (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  title text not null,
  protocol_version text not null,
  intervention text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED')),
  target_enrollment int not null,
  consent_version text,
  ctri_state text not null default 'DRAFT' check (ctri_state in ('DRAFT','REF','REGISTERED')), -- REF ≠ registered
  ctri_ref text,
  ctri_registered_at timestamptz,
  ctri_renewal_due_at timestamptz,
  start_date date,
  end_date date
);

create table public.sites (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  name text not null,
  city text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE'))
);

create table public.trial_sites (
  trial_id uuid references public.trials(id) on delete cascade,
  site_id uuid references public.sites(id),
  primary key (trial_id, site_id)
);

create table public.trial_approvals (
  id uuid primary key default uuid_generate_v4(),
  trial_id uuid not null references public.trials(id) on delete cascade,
  site_id uuid references public.sites(id),
  kind text not null check (kind in ('ETHICS','CTRI')),
  code text,
  status text not null check (status in ('SUBMITTED','UNDER_REVIEW','APPROVED','EXPIRED','DRAFT','REF','REGISTERED')),
  submitted_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz,
  document_name text,
  owner text,
  reviewer text,
  rationale text
);

create table public.participants (
  id uuid primary key default uuid_generate_v4(),
  trial_id uuid not null references public.trials(id),
  site_id uuid not null references public.sites(id),
  subject_code text not null, -- synthetic coded identity only (AYU-####)
  status text not null default 'SCREENING' check (status in ('SCREENING','SCREENED','ENROLLED','WITHDRAWN','SCREEN_FAILED')),
  created_at timestamptz not null default now(),
  created_by text,
  unique (trial_id, subject_code)  -- duplicate-enrollment guard at the database level
);
create index idx_participants_trial on public.participants(trial_id);
create index idx_participants_site on public.participants(site_id);
create index idx_participants_status on public.participants(status);

create table public.screenings (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  items jsonb not null default '[]',
  pi_reviewed_at timestamptz,
  pi_reviewed_by text,
  notes text
);

create table public.consents (
  id uuid primary key default uuid_generate_v4(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  version text not null,
  language text not null,
  status text not null check (status in ('PENDING','ACCEPTED','DECLINED','WITHDRAWN')),
  action_at timestamptz not null default now(),
  staff text,
  witness text,
  signature text default 'Simulated (demo)', -- demo only, not a legal e-signature
  reason text
);
create index idx_consents_participant on public.consents(participant_id);

create table public.enrollments (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  trial_id uuid not null references public.trials(id),
  site_id uuid not null references public.sites(id),
  enrolled_at timestamptz not null default now(),
  enrolled_by text
);
create index idx_enrollments_trial on public.enrollments(trial_id);

create table public.visits (
  id uuid primary key default uuid_generate_v4(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  trial_id uuid not null references public.trials(id),
  visit_type text not null check (visit_type in ('SCREENING','BASELINE','V1','V2','V3','FOLLOW_UP')),
  due_at timestamptz not null,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED','COMPLETED','CANCELLED')),
  completed_at timestamptz,
  completed_by text
);
create index idx_visits_trial on public.visits(trial_id);
create index idx_visits_status on public.visits(status);
create index idx_visits_due on public.visits(due_at);

create table public.observations (
  id uuid primary key default uuid_generate_v4(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  fields jsonb not null default '{}', -- protocol-defined values only
  created_at timestamptz not null default now(),
  created_by text
);

create table public.lab_results (
  id uuid primary key default uuid_generate_v4(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  visit_id uuid references public.visits(id),
  test text not null,
  value numeric not null,
  unit text not null,
  ref_low numeric,
  ref_high numeric,
  collected_at date not null,
  status text not null default 'FINAL' check (status in ('FINAL','PENDING')),
  flag text check (flag in ('OUT_OF_RANGE')),
  created_by text,
  created_at timestamptz not null default now()
);

create table public.safety_events (
  id uuid primary key default uuid_generate_v4(),
  case_no text unique not null,
  participant_id uuid not null references public.participants(id),
  trial_id uuid not null references public.trials(id),
  term text not null,
  narrative text not null,
  onset_at date not null,
  awareness_at date,
  seriousness text not null check (seriousness in ('SERIOUS','NON_SERIOUS')),
  seriousness_criteria text[] not null default '{}',
  severity text not null check (severity in ('MILD','MODERATE','SEVERE')),
  suspected_product text,
  batch text,
  outcome text,
  status text not null check (status in ('IDENTIFIED','PI_REVIEW_PENDING','PI_REVIEWED','PV_IN_REVIEW','FOLLOW_UP','CLOSED')),
  pi_reviewed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  case_log jsonb not null default '[]'
);
create index idx_safety_trial on public.safety_events(trial_id);

create table public.pv_tasks (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references public.safety_events(id) on delete cascade,
  task_type text not null check (task_type in ('COMPLETENESS_REVIEW','FOLLOW_UP')),
  due_at timestamptz not null,
  status text not null check (status in ('PENDING','IN_REVIEW','FOLLOW_UP_DUE','DONE')),
  owner text,
  created_at timestamptz not null default now()
);
create index idx_pv_tasks_status on public.pv_tasks(status);

create table public.queries (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  trial_id uuid not null references public.trials(id),
  site_id uuid not null references public.sites(id),
  participant_id uuid references public.participants(id),
  visit_id uuid references public.visits(id),
  category text,
  question text not null,
  due_at timestamptz not null,
  status text not null check (status in ('OPEN','RESPONDED','RESOLVED')),
  created_by text,
  created_at timestamptz not null default now(),
  response jsonb,
  resolution jsonb
);
create index idx_queries_trial on public.queries(trial_id);
create index idx_queries_status on public.queries(status);

create table public.monitoring_records (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  trial_id uuid not null references public.trials(id),
  site_id uuid not null references public.sites(id),
  participant_id uuid references public.participants(id),
  description text not null,
  severity text not null check (severity in ('MINOR','MAJOR','NOTE')),
  status text not null check (status in ('OPEN','ACKNOWLEDGED','CLOSED')),
  source_context text,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  at timestamptz not null default now(),
  title text not null,
  body text,
  link text,
  roles text[] not null default '{}',
  read_by text[] not null default '{}'
);

-- Append-style audit log (application-level history; integrity services would be
-- added for WORM/valid-archival claims, which this prototype does NOT make).
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  at timestamptz not null default now(),
  actor text not null,
  role text not null,
  entity text not null,
  entity_id text not null,
  action text not null,
  old_state text,
  new_state text,
  reason text
);
create index idx_audit_at on public.audit_logs(at desc);
revoke delete, update on public.audit_logs from public; -- restrictive writes

-- ----------------------------------------------------------------------------
-- Row Level Security: role claims come from profiles; MONITOR is site-scoped;
-- LEADERSHIP has no participant-level select. Helper below is used in policies.
-- ----------------------------------------------------------------------------
create or replace function public.current_role() returns text language sql stable as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.in_site_scope(site uuid) returns boolean language sql stable as $$
  select case when public.current_role() = 'MONITOR'
    then site = any((select site_scope from public.profiles where id = auth.uid()))
    else true end;
$$;

alter table public.participants enable row level security;
create policy participants_read on public.participants for select using (
  public.current_role() in ('ADMIN','PI','COORDINATOR','MONITOR','PV_OFFICER')
  and public.in_site_scope(site_id)
);
create policy participants_write on public.participants for update using (public.current_role() = 'COORDINATOR');

alter table public.consents enable row level security;
create policy consents_read on public.consents for select using (
  exists (select 1 from public.participants p where p.id = participant_id and public.in_site_scope(p.site_id)
          and public.current_role() in ('ADMIN','PI','COORDINATOR','MONITOR','PV_OFFICER'))
);

alter table public.queries enable row level security;
create policy queries_read on public.queries for select using (public.in_site_scope(site_id));
create policy queries_respond on public.queries for update using (
  (public.current_role() = 'COORDINATOR' and status = 'OPEN')
  or (public.current_role() in ('MONITOR','PI') and status in ('OPEN','RESPONDED'))
);

-- (Apply equivalent policies to visits, observations, lab_results, safety_events,
--  pv_tasks, monitoring_records, trial_approvals, audit_logs. LEADERSHIP gets
--  aggregate-only views, e.g. a security-definer kpis() function, never tables.)

-- NOTE: service-role keys must never be exposed to the client; all writes go
-- through server actions / route handlers that validate → authorize → mutate →
-- audit → return updated state.
