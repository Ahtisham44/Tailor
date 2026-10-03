-- Pay the current month's total outstanding balance, including unpaid work
-- assigned in earlier months. The karigar row lock serializes payment requests.
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
     or p_period_start <> date_trunc('month', now() at time zone 'Asia/Karachi')::date then
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
     and a.created_at < ((p_period_start + interval '1 month')::timestamp at time zone 'Asia/Karachi');

  select coalesce(sum(p.amount), 0) into v_paid
    from public.karigar_payouts p
   where p.karigar_id = v_karigar.id
     and p.user_id = (select auth.uid())
     and p.period_start <= p_period_start;

  v_amount := round(v_earned - v_paid, 2);
  if v_amount <= 0 then return 0; end if;

  insert into public.karigar_payouts (karigar_id, user_id, period_start, amount)
  values (v_karigar.id, (select auth.uid()), p_period_start, v_amount);
  return v_amount;
end;
$$;

revoke all on function public.record_karigar_monthly_payment(text, date) from public, anon;
grant execute on function public.record_karigar_monthly_payment(text, date) to authenticated;
