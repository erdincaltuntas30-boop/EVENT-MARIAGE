-- Row Level Security : isolation stricte par organisation.

create function is_member(org uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from memberships where org_id = org and user_id = auth.uid());
$$;

create function is_admin(org uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from memberships where org_id = org and user_id = auth.uid() and role = 'admin');
$$;

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table memberships enable row level security;
alter table leads enable row level security;
alter table events enable row level security;
alter table event_tasks enable row level security;
alter table vendors enable row level security;
alter table event_vendors enable row level security;
alter table payments enable row level security;
alter table automations enable row level security;
alter table automation_events enable row level security;
alter table org_webhooks enable row level security;
alter table org_secrets enable row level security; -- aucune policy : service role uniquement
alter table api_keys enable row level security;

-- Organisations
create policy org_select on organizations for select using (is_member(id));
create policy org_update on organizations for update using (is_admin(id)) with check (is_admin(id));

-- Profils : soi-même + collègues d'une organisation commune
create policy profiles_select on profiles for select using (
  id = auth.uid() or exists (
    select 1 from memberships m1 join memberships m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  )
);
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Membres
create policy memberships_select on memberships for select using (is_member(org_id));
create policy memberships_admin_insert on memberships for insert with check (is_admin(org_id));
create policy memberships_admin_update on memberships for update using (is_admin(org_id)) with check (is_admin(org_id));
create policy memberships_admin_delete on memberships for delete using (is_admin(org_id) and user_id <> auth.uid());

-- Tables métier : tout membre de l'organisation
do $$
declare t text;
begin
  foreach t in array array['leads','events','event_tasks','vendors','event_vendors','payments','automation_events'] loop
    execute format('create policy %1$s_select on %1$s for select using (is_member(org_id))', t);
    execute format('create policy %1$s_insert on %1$s for insert with check (is_member(org_id))', t);
    execute format('create policy %1$s_update on %1$s for update using (is_member(org_id)) with check (is_member(org_id))', t);
    execute format('create policy %1$s_delete on %1$s for delete using (is_member(org_id))', t);
  end loop;
end $$;

-- Automatisations : lecture par tous, activation/pause par tous les membres, création/suppression admin
create policy automations_select on automations for select using (is_member(org_id));
create policy automations_update on automations for update using (is_member(org_id)) with check (is_member(org_id));
create policy automations_insert on automations for insert with check (is_admin(org_id));
create policy automations_delete on automations for delete using (is_admin(org_id));

-- Intégrations : admins uniquement
create policy org_webhooks_select on org_webhooks for select using (is_admin(org_id));
create policy org_webhooks_write on org_webhooks for all using (is_admin(org_id)) with check (is_admin(org_id));

-- api_keys : la colonne secret_enc n'est jamais exposée au client (privilège colonne retiré).
create policy api_keys_select on api_keys for select using (is_admin(org_id));
revoke select on api_keys from anon, authenticated;
grant select (id, org_id, key_id, last4, label, created_by, created_at, expires_at, revoked_at, last_used_at)
  on api_keys to authenticated;
-- Création / rotation / révocation passent par le serveur (service role).

-- ───────────────────────── Stockage des logos ─────────────────────────
insert into storage.buckets (id, name, public) values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy logos_read on storage.objects for select using (bucket_id = 'logos');
create policy logos_write on storage.objects for insert with check (
  bucket_id = 'logos' and is_admin(((storage.foldername(name))[1])::uuid)
);
create policy logos_update on storage.objects for update using (
  bucket_id = 'logos' and is_admin(((storage.foldername(name))[1])::uuid)
);
create policy logos_delete on storage.objects for delete using (
  bucket_id = 'logos' and is_admin(((storage.foldername(name))[1])::uuid)
);

-- ───────────────────────── Realtime ─────────────────────────
alter publication supabase_realtime add table automation_events, leads, events, automations;
