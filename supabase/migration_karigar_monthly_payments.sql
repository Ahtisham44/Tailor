-- Immutable payments against monthly karigar earnings. Derive the foreign-key
-- type from karigar.id so this migration works with existing installations.
do $$
declare
  v_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into v_id_type
    from pg_attribute a
   where a.attrelid = 'public.karigar'::regclass
     and a.attname = 'id' and not a.attisdropped;

  execute format($ddl$
    create table if not exists public.karigar_payouts (
      id bigint generated always as identity primary key,
      karigar_id %s not null references public.karigar(id) on delete cascade,
      user_id uuid not null default auth.uid(),
      period_start date not null,
      amount numeric(14, 2) not null check (amount > 0),
      paid_at date not null default (now() at time zone 'Asia/Karachi')::date,
      created_at timestamptz not null default now(),
      legacy_payment_id text unique,
      check (period_start = date_trunc('month', period_start)::date)
    )
  $ddl$, v_id_type);
end;
$$;

create index if not exists karigar_payouts_owner_karigar_period_idx
  on public.karigar_payouts (user_id, karigar_id, period_start);

create index if not exists karigar_assignments_owner_month_idx
  on public.karigar_order_assignments (user_id, karigar_id, created_at);

alter table public.karigar_payouts enable row level security;

drop policy if exists karigar_payouts_select on public.karigar_payouts;
create policy karigar_payouts_select on public.karigar_payouts
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists karigar_payouts_insert on public.karigar_payouts;
create policy karigar_payouts_insert on public.karigar_payouts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.karigar k
       where k.id = karigar_id and k.user_id = (select auth.uid())
    )
  );

grant select, insert on public.karigar_payouts to authenticated;

-- Preserve historical paid rows, including their original paid dates. Old
-- periods are attributed to the month in which they started.
do $$
begin
  if to_regclass('public.karigar_payments') is not null then
    insert into public.karigar_payouts
      (karigar_id, user_id, period_start, amount, paid_at, legacy_payment_id)
    select p.karigar_id, p.user_id,
           date_trunc('month', p.period_start)::date,
           p.total_payable,
           coalesce(p.date_paid, p.period_end, (now() at time zone 'Asia/Karachi')::date),
           p.id::text
      from public.karigar_payments p
     where p.status = 'paid' and p.total_payable > 0 and p.period_start is not null
    on conflict (legacy_payment_id) do nothing;
  end if;
end;
$$;

-- The row lock serializes payments for a karigar, so two clicks cannot record
-- the same balance. Work is grouped by assignment date in Pakistan time.
create or replace function public.record_karigar_monthly_payment(
  p_karigar_id text,
  p_period_start date
)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_karigar public.karigar%rowtype;
  v_earned numeric(14, 2);
  v_paid numeric(14, 2);
  v_amount numeric(14, 2);
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_period_start is null
     or p_period_start <> date_trunc('month', p_period_start)::date
     or p_period_start > date_trunc('month', now() at time zone 'Asia/Karachi')::date then
    raise exception 'Invalid payment month';
  end if;

  select * into v_karigar from public.karigar k
   where k.id::text = p_karigar_id and k.user_id = (select auth.uid())
   for update;
  if not found then
    raise exception 'Karigar not found';
  end if;

  select coalesce(sum(a.agreed_rate), 0) into v_earned
    from public.karigar_order_assignments a
   where a.karigar_id = v_karigar.id
     and a.user_id = (select auth.uid())
     and a.created_at >= (p_period_start::timestamp at time zone 'Asia/Karachi')
     and a.created_at < ((p_period_start + interval '1 month')::timestamp at time zone 'Asia/Karachi');

  select coalesce(sum(p.amount), 0) into v_paid
    from public.karigar_payouts p
   where p.karigar_id = v_karigar.id
     and p.user_id = (select auth.uid())
     and p.period_start = p_period_start;

  v_amount := round(v_earned - v_paid, 2);
  if v_amount <= 0 then return 0; end if;

  insert into public.karigar_payouts (karigar_id, user_id, period_start, amount)
  values (v_karigar.id, (select auth.uid()), p_period_start, v_amount);
  return v_amount;
end;
$$;

revoke all on function public.record_karigar_monthly_payment(text, date) from public, anon;
grant execute on function public.record_karigar_monthly_payment(text, date) to authenticated;
