-- Vérification de l'isolation multi-tenant (SQL Editor de Supabase, après « npm run seed »).
-- On se fait passer pour l'utilisateur témoin : il ne doit voir AUCUNE donnée de Maison Lumière.

begin;

-- Identifiants lus AVANT de passer sous RLS
select set_config('test.ml_org', (select id::text from organizations where slug = 'maison-lumiere'), true);
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'temoin@event-mariage.test'), 'role', 'authenticated')::text,
  true);
set local role authenticated;

select 'organisations visibles' as test, count(*) as resultat, 1 as attendu from organizations
union all
select 'leads visibles (agence témoin)', count(*), 3 from leads
union all
select 'leads Maison Lumière', count(*), 0 from leads where org_id = current_setting('test.ml_org')::uuid
union all
select 'mariages Maison Lumière', count(*), 0 from events where org_id = current_setting('test.ml_org')::uuid
union all
select 'activité Maison Lumière', count(*), 0 from automation_events where org_id = current_setting('test.ml_org')::uuid
union all
select 'secrets lisibles', count(*), 0 from org_secrets;

-- Une écriture dans une autre organisation doit échouer (« new row violates row-level security policy ») :
-- insert into leads (org_id, first_name) values (current_setting('test.ml_org')::uuid, 'Intrus');

rollback;
