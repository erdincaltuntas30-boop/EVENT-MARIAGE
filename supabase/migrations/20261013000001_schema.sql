-- Event Mariage : schéma multi-tenant
-- Toutes les tables métier portent org_id et sont protégées par RLS.

create extension if not exists "pgcrypto";

-- ───────────────────────── Types ─────────────────────────
create type member_role as enum ('admin', 'planner');
create type lead_source as enum ('form', 'instagram', 'mariages_net', 'email', 'other');
create type lead_stage as enum ('new', 'qualified', 'meeting', 'proposal', 'won', 'lost');
create type event_status as enum ('planned', 'done', 'cancelled');
create type task_milestone as enum ('J-90', 'J-30', 'J-7', 'J-1', 'custom');
create type payment_status as enum ('pending', 'received', 'overdue');
create type activity_status as enum ('pending', 'success', 'error', 'info');
create type activity_actor as enum ('automation', 'user', 'system');
create type webhook_action as enum (
  'lead.follow_up', 'lead.send_proposal', 'lead.stage_changed', 'automation.toggle', 'automation.retry'
);

-- ───────────────────────── Organisations & membres ─────────────────────────
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  accent_color text not null default '#4F6B5A',
  locale text not null default 'fr',
  timezone text not null default 'Europe/Paris',
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table memberships (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'planner',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on memberships(user_id);

-- Création automatique du profil à l'inscription
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────────────────── Métier ─────────────────────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  external_id text,
  first_name text not null,
  last_name text,
  partner_name text,
  email text,
  phone text,
  source lead_source not null default 'other',
  stage lead_stage not null default 'new',
  wedding_date date,
  budget_cents bigint,
  guest_count int,
  venue text,
  notes text,
  first_response_at timestamptz,
  lost_reason text,
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, external_id)
);
create index leads_org_stage_idx on leads(org_id, stage);
create index leads_org_created_idx on leads(org_id, created_at desc);

create table events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  external_id text,
  lead_id uuid references leads(id) on delete set null,
  title text not null,
  couple_names text,
  date date not null,
  venue text,
  guest_count int,
  contract_amount_cents bigint not null default 0,
  status event_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, external_id)
);
create index events_org_date_idx on events(org_id, date);

create table event_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  external_id text,
  title text not null,
  milestone task_milestone not null default 'custom',
  due_date date,
  done_at timestamptz,
  done_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, external_id)
);
create index event_tasks_event_idx on event_tasks(event_id);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
create index vendors_org_idx on vendors(org_id);

create table event_vendors (
  event_id uuid not null references events(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role text,
  amount_cents bigint,
  primary key (event_id, vendor_id)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  external_id text,
  label text not null,
  amount_cents bigint not null,
  due_date date,
  status payment_status not null default 'pending',
  received_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, external_id)
);
create index payments_event_idx on payments(event_id);

-- ───────────────────────── Automatisations ─────────────────────────
create table automations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  trigger_label text,
  category text not null default 'leads',
  is_enabled boolean not null default true,
  minutes_saved_per_run int not null default 5,
  created_at timestamptz not null default now(),
  unique (org_id, key)
);

create table automation_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  external_id text not null default gen_random_uuid()::text,
  automation_id uuid references automations(id) on delete set null,
  type text not null,
  status activity_status not null default 'info',
  actor activity_actor not null default 'automation',
  actor_user_id uuid references auth.users(id) on delete set null,
  lead_id uuid references leads(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  error_message text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (org_id, external_id)
);
create index automation_events_org_time_idx on automation_events(org_id, occurred_at desc);
create index automation_events_lead_idx on automation_events(lead_id, occurred_at desc);
create index automation_events_automation_idx on automation_events(automation_id, occurred_at desc);

-- ───────────────────────── Intégrations ─────────────────────────
create table org_webhooks (
  org_id uuid not null references organizations(id) on delete cascade,
  action webhook_action not null,
  url text not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, action)
);

-- Secrets : aucune policy, accessibles uniquement via le service role (serveur).
create table org_secrets (
  org_id uuid primary key references organizations(id) on delete cascade,
  outbound_secret_enc text not null,
  created_at timestamptz not null default now()
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  key_id text not null unique,
  secret_enc text not null,
  last4 text not null,
  label text not null default 'n8n',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index api_keys_org_idx on api_keys(org_id);

-- updated_at automatique
create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger leads_touch before update on leads for each row execute function touch_updated_at();
create trigger events_touch before update on events for each row execute function touch_updated_at();

create function touch_stage_changed() returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then new.stage_changed_at = now(); end if;
  return new;
end $$;
create trigger leads_stage_touch before update on leads for each row execute function touch_stage_changed();
