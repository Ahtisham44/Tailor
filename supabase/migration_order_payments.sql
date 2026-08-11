-- Partial payments ledger for customer orders.
-- Each row is one payment received against an order (advance, installment, balance).
create table if not exists public.order_payments (
  id         bigint generated always as identity primary key,
  order_id   bigint not null references public.orders(id) on delete cascade,
  user_id    uuid   not null default auth.uid(),
  amount     numeric not null check (amount > 0),
  method     text not null default 'cash'
             check (method = any (array['cash','jazzcash','easypaisa','bank','other'])),
  paid_at    date not null default current_date,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists order_payments_order_id_idx on public.order_payments(order_id);
create index if not exists order_payments_user_id_idx  on public.order_payments(user_id);

alter table public.order_payments enable row level security;

-- Mirror the orders table: one ALL policy scoping every row to the owning shop.
drop policy if exists shop_isolation on public.order_payments;
create policy shop_isolation on public.order_payments
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
