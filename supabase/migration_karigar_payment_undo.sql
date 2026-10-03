-- Undo only the caller's recent, newly recorded karigar payouts. Lock the
-- karigar row used by record_karigar_monthly_payment to serialize both actions.
create or replace function public.undo_karigar_monthly_payment(p_payout_id bigint)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_karigar_id text;
  v_payout public.karigar_payouts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select p.karigar_id::text into v_karigar_id
    from public.karigar_payouts p
   where p.id = p_payout_id and p.user_id = v_user_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  perform 1 from public.karigar k
   where k.id::text = v_karigar_id and k.user_id = v_user_id
   for update;
  if not found then
    raise exception 'Karigar not found';
  end if;

  select * into v_payout from public.karigar_payouts p
   where p.id = p_payout_id and p.user_id = v_user_id
   for update;
  if not found then
    raise exception 'Payment already undone';
  end if;
  if v_payout.legacy_payment_id is not null
     or v_payout.created_at > now()
     or v_payout.created_at <= now() - interval '5 minutes' then
    raise exception 'The five-minute undo window has expired';
  end if;

  delete from public.karigar_payouts p
   where p.id = v_payout.id and p.user_id = v_user_id;
  return v_payout.amount;
end;
$$;

revoke all on function public.undo_karigar_monthly_payment(bigint) from public, anon;
grant execute on function public.undo_karigar_monthly_payment(bigint) to authenticated;
