-- One balance calculation for the app and the monthly sender. The view runs
-- with the caller's privileges, so authenticated reads respect table RLS.
create or replace view public.karigar_completed_payables
with (security_invoker = true) as
select k.id::text as karigar_id, k.user_id, k.name,
  (date_trunc('month', now() at time zone 'Asia/Karachi') - interval '1 month')::date as period_start,
  round(coalesce(a.earned, 0) - coalesce(p.paid, 0), 2) as balance
from public.karigar k
left join lateral (
  select sum(x.agreed_rate) as earned
  from public.karigar_order_assignments x
  where x.karigar_id = k.id and x.user_id = k.user_id
    and x.created_at < (date_trunc('month', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi')
) a on true
left join lateral (
  select sum(x.amount) as paid
  from public.karigar_payouts x
  where x.karigar_id = k.id and x.user_id = k.user_id
) p on true
where k.status = 'active'
  and coalesce(a.earned, 0) - coalesce(p.paid, 0) > 0;

grant select on public.karigar_completed_payables to authenticated, service_role;

create table if not exists public.karigar_push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists karigar_push_subscriptions_user_idx
  on public.karigar_push_subscriptions (user_id);
alter table public.karigar_push_subscriptions enable row level security;
create policy karigar_push_subscriptions_select on public.karigar_push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy karigar_push_subscriptions_insert on public.karigar_push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy karigar_push_subscriptions_delete on public.karigar_push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.karigar_push_subscriptions to authenticated;

create table if not exists public.karigar_push_deliveries (
  id bigint generated always as identity primary key,
  period_start date not null,
  karigar_id text not null,
  subscription_id bigint not null references public.karigar_push_subscriptions(id) on delete cascade,
  sent_at timestamptz,
  unique (period_start, karigar_id, subscription_id)
);
alter table public.karigar_push_deliveries enable row level security;
-- Delivery records are only used through the service role.
revoke all on public.karigar_push_deliveries from anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
-- Set Vault secrets karigar_push_project_url and karigar_push_cron_secret
-- before the first run. The latter must match the Edge Function CRON_SECRET.
select cron.schedule(
  'karigar-payment-push-monthly', '0 6 1 * *',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'karigar_push_project_url') || '/functions/v1/karigar-payment-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'karigar_push_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );$$
);
