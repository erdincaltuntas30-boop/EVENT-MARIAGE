-- Indicateurs métier. Les vues et fonctions s'exécutent avec les droits de l'appelant (RLS appliquée).

create view automation_stats with (security_invoker = true) as
select
  a.id as automation_id,
  a.org_id,
  count(e.id) filter (where e.status in ('success', 'error'))::int as runs_total,
  count(e.id) filter (where e.status = 'success')::int as runs_success,
  count(e.id) filter (where e.status = 'error')::int as runs_error,
  count(e.id) filter (where e.status in ('success', 'error') and e.occurred_at > now() - interval '30 days')::int as runs_30d,
  max(e.occurred_at) filter (where e.status in ('success', 'error')) as last_run_at,
  (array_agg(e.status order by e.occurred_at desc) filter (where e.status in ('success', 'error')))[1] as last_status
from automations a
left join automation_events e on e.automation_id = a.id
group by a.id, a.org_id;

-- Probabilité de signature par étape, pour le CA prévisionnel
create function stage_probability(s lead_stage) returns numeric
language sql immutable as $$
  select case s
    when 'new' then 0.10 when 'qualified' then 0.25 when 'meeting' then 0.50
    when 'proposal' then 0.70 when 'won' then 1 else 0 end;
$$;

create function kpis_for_range(p_org uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'new_leads', (select count(*) from leads where org_id = p_org and created_at >= p_from and created_at < p_to),
    'won_leads', (select count(*) from leads where org_id = p_org and created_at >= p_from and created_at < p_to and stage = 'won'),
    'signed_revenue_cents', (select coalesce(sum(contract_amount_cents), 0) from events
                             where org_id = p_org and created_at >= p_from and created_at < p_to and status <> 'cancelled'),
    'avg_first_response_minutes', (select round(avg(extract(epoch from (first_response_at - created_at)) / 60)::numeric, 1)
                                   from leads where org_id = p_org and first_response_at is not null
                                   and created_at >= p_from and created_at < p_to),
    'hours_saved', (select round(coalesce(sum(a.minutes_saved_per_run), 0) / 60.0, 1)
                    from automation_events e join automations a on a.id = e.automation_id
                    where e.org_id = p_org and e.status = 'success' and e.occurred_at >= p_from and e.occurred_at < p_to)
  );
$$;

-- KPIs de la période + période précédente de même durée (pour les variations)
create function dashboard_kpis(p_org uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable as $$
begin
  if not is_member(p_org) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'current', kpis_for_range(p_org, p_from, p_to),
    'previous', kpis_for_range(p_org, p_from - (p_to - p_from), p_from),
    'forecast_revenue_cents', (select coalesce(round(sum(budget_cents * stage_probability(stage))), 0)
                               from leads where org_id = p_org and stage not in ('won', 'lost')),
    'open_leads', (select count(*) from leads where org_id = p_org and stage not in ('won', 'lost'))
  );
end $$;

-- Série hebdomadaire : nouveaux leads et mariages signés
create function weekly_pipeline(p_org uuid, p_weeks int default 12)
returns table (week date, leads int, signed int) language sql stable as $$
  with weeks as (
    select generate_series(date_trunc('week', now()) - ((p_weeks - 1) || ' weeks')::interval,
                           date_trunc('week', now()), interval '1 week')::date as week
  )
  select w.week,
    (select count(*)::int from leads l where l.org_id = p_org and date_trunc('week', l.created_at)::date = w.week),
    (select count(*)::int from events e where e.org_id = p_org and date_trunc('week', e.created_at)::date = w.week)
  from weeks w order by w.week;
$$;

grant execute on function dashboard_kpis(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function weekly_pipeline(uuid, int) to authenticated;
