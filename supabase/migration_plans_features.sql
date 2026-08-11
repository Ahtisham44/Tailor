-- =============================================================================
-- Tailor365 — Plans, per-plan features, per-user overrides, tailor logo/shop
-- =============================================================================
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- It is idempotent: safe to run more than once.
--
-- What it does
--   1. Adds `max_customers`, `features` (jsonb) and `sort_order` to `plans`.
--   2. Seeds / upserts the Free, Pro and "The Max" plans with sensible defaults.
--   3. Adds `logo_url` + `shop_name` to the tailor profile table.
--   4. Adds per-user override columns (custom customer cap + custom features)
--      to `subscriptions`, so a single tailor can get a bespoke plan.
--   5. Rewrites `effective_plan()` to merge: free defaults < plan < per-user
--      override. It returns max_customers + a merged `features` jsonb.
--   6. Adds admin-only, security-definer RPCs to manage plans and overrides:
--        admin_list_plans(), admin_upsert_plan(...), admin_delete_plan(...),
--        admin_set_user_overrides(...).
--
-- NOTE on table names: this project stores tailor display info on a `profiles`
-- table keyed by auth user id. If yours differs, adjust the PROFILE_TABLE
-- references (search for `profiles`).
-- =============================================================================

begin;

-- ── 1. plans: new columns ───────────────────────────────────────────────────
alter table public.plans
  add column if not exists max_customers integer,                       -- null = unlimited
  add column if not exists features      jsonb   not null default '{}'::jsonb,
  add column if not exists sort_order    integer not null default 100;

comment on column public.plans.max_customers is 'Max customers allowed; NULL = unlimited';
comment on column public.plans.features      is 'Feature flags, e.g. {"karigar": true, "reports": true}';

-- ── 2. seed / upsert the three plans ────────────────────────────────────────
-- Adjust price_pkr to your real prices. Free is 0 / unpriced.
insert into public.plans (id, name, price_pkr, max_customers, features, sort_order)
values
  ('free', 'Free',     0,    50,   '{"karigar": false, "reports": true}'::jsonb,  10),
  ('pro',  'Pro',      1500, null, '{"karigar": false, "reports": true}'::jsonb,  20),
  ('max',  'The Max',  3000, null, '{"karigar": true,  "reports": true}'::jsonb,  30)
on conflict (id) do update
  set name          = excluded.name,
      -- keep existing price if you've already customised it; comment the next
      -- line out if you'd rather force the seed price.
      price_pkr     = coalesce(public.plans.price_pkr, excluded.price_pkr),
      max_customers = coalesce(public.plans.max_customers, excluded.max_customers),
      features      = case when public.plans.features = '{}'::jsonb
                           then excluded.features else public.plans.features end,
      sort_order    = excluded.sort_order;

-- ── 3. tailor profile: logo + shop name ─────────────────────────────────────
alter table public.profiles
  add column if not exists logo_url  text,
  add column if not exists shop_name text;

-- ── 4. per-user overrides on subscriptions ──────────────────────────────────
-- A non-null override wins over the plan default. override_features is merged
-- on top of the plan's features (per-key), so you can flip a single feature.
alter table public.subscriptions
  add column if not exists override_max_customers integer,
  add column if not exists override_features      jsonb;

comment on column public.subscriptions.override_max_customers is 'Per-user custom customer cap; NULL = use plan value';
comment on column public.subscriptions.override_features      is 'Per-user feature overrides merged over the plan, e.g. {"karigar": true}';

-- ── 5. effective_plan(): merge free < plan < per-user override ──────────────
-- Returns one row: id, name, max_customers, features (merged jsonb).
create or replace function public.effective_plan()
returns table (
  id            text,
  name          text,
  max_customers integer,
  features      jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_sub        public.subscriptions%rowtype;
  v_plan       public.plans%rowtype;
  v_free       public.plans%rowtype;
  v_active     boolean := false;
begin
  select * into v_free from public.plans where id = 'free';

  -- latest subscription for this user, if any
  select * into v_sub
    from public.subscriptions
   where user_id = v_uid
   order by created_at desc
   limit 1;

  -- a subscription counts only while it hasn't expired and isn't canceled
  if v_sub.user_id is not null
     and coalesce(v_sub.status, 'active') <> 'canceled'
     and (v_sub.current_period_end is null or v_sub.current_period_end > now())
  then
    v_active := true;
  end if;

  if v_active then
    select * into v_plan from public.plans where id = v_sub.plan_id;
  end if;
  if v_plan.id is null then
    v_plan := v_free;        -- fall back to Free
  end if;

  id            := v_plan.id;
  name          := v_plan.name;
  -- override cap wins if present (only when a live sub exists)
  max_customers := case
                     when v_active and v_sub.override_max_customers is not null
                       then v_sub.override_max_customers
                     else v_plan.max_customers
                   end;
  -- merge plan features with per-user overrides (override keys win)
  features      := coalesce(v_plan.features, '{}'::jsonb)
                   || case when v_active then coalesce(v_sub.override_features, '{}'::jsonb)
                           else '{}'::jsonb end;

  return next;
end;
$$;

grant execute on function public.effective_plan() to authenticated;

-- ── helper: is the caller an admin? (reuse existing predicate) ──────────────
-- This project already has is_current_user_admin(); we depend on it below.

-- ── 6a. list plans (admin) ──────────────────────────────────────────────────
create or replace function public.admin_list_plans()
returns setof public.plans
language sql
security definer
set search_path = public
as $$
  select * from public.plans
  where public.is_current_user_admin()
  order by sort_order asc, price_pkr asc nulls first;
$$;
grant execute on function public.admin_list_plans() to authenticated;

-- ── 6b. create / update a plan (admin) ──────────────────────────────────────
create or replace function public.admin_upsert_plan(
  p_id            text,
  p_name          text,
  p_price_pkr     numeric,
  p_max_customers integer,
  p_features      jsonb,
  p_sort_order    integer default 100
)
returns public.plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.plans%rowtype;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;
  if p_id is null or length(trim(p_id)) = 0 then
    raise exception 'plan id is required';
  end if;

  insert into public.plans (id, name, price_pkr, max_customers, features, sort_order)
  values (lower(trim(p_id)), p_name, p_price_pkr, p_max_customers,
          coalesce(p_features, '{}'::jsonb), coalesce(p_sort_order, 100))
  on conflict (id) do update
    set name          = excluded.name,
        price_pkr     = excluded.price_pkr,
        max_customers = excluded.max_customers,
        features      = excluded.features,
        sort_order    = excluded.sort_order
  returning * into v_row;

  insert into public.admin_audit (action, detail)
  values ('upsert_plan', jsonb_build_object('plan_id', v_row.id, 'name', v_row.name));

  return v_row;
end;
$$;
grant execute on function public.admin_upsert_plan(text, text, numeric, integer, jsonb, integer) to authenticated;

-- ── 6c. delete a plan (admin) ───────────────────────────────────────────────
create or replace function public.admin_delete_plan(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;
  if lower(trim(p_id)) = 'free' then
    raise exception 'the free plan cannot be deleted';
  end if;
  if exists (select 1 from public.subscriptions where plan_id = p_id
               and coalesce(status,'active') <> 'canceled'
               and (current_period_end is null or current_period_end > now())) then
    raise exception 'plan has active subscribers; move them off it first';
  end if;

  delete from public.plans where id = p_id;
  insert into public.admin_audit (action, detail)
  values ('delete_plan', jsonb_build_object('plan_id', p_id));
end;
$$;
grant execute on function public.admin_delete_plan(text) to authenticated;

-- ── 6d. set per-user overrides (admin) ──────────────────────────────────────
-- Ensures the user has a subscription row to hang the override on. If they're
-- on free with no row, we create one on the given/base plan so the override
-- takes effect. Pass nulls to clear an override.
create or replace function public.admin_set_user_overrides(
  p_target_user_id        uuid,
  p_override_max_customers integer,
  p_override_features      jsonb,
  p_plan_id               text default null     -- optionally also move them to a plan
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id uuid;
  v_plan   text;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;

  select id into v_sub_id
    from public.subscriptions
   where user_id = p_target_user_id
   order by created_at desc
   limit 1;

  v_plan := coalesce(p_plan_id,
              (select plan_id from public.subscriptions where id = v_sub_id),
              'free');

  if v_sub_id is null then
    insert into public.subscriptions (user_id, plan_id, status, override_max_customers, override_features)
    values (p_target_user_id, v_plan, 'active', p_override_max_customers, p_override_features);
  else
    update public.subscriptions
       set override_max_customers = p_override_max_customers,
           override_features      = p_override_features,
           plan_id                = v_plan
     where id = v_sub_id;
  end if;

  insert into public.admin_audit (action, detail)
  values ('set_user_overrides', jsonb_build_object(
            'target', p_target_user_id, 'plan', v_plan,
            'max_customers', p_override_max_customers, 'features', p_override_features));
end;
$$;
grant execute on function public.admin_set_user_overrides(uuid, integer, jsonb, text) to authenticated;

-- ── 6e. extend admin_list_users_with_plan to expose overrides ───────────────
-- The Tailors tab pre-fills the per-user override dialog from these fields.
-- This recreates the function; if your existing version returns extra columns,
-- merge those back in. It must remain admin-gated.
create or replace function public.admin_list_users_with_plan()
returns table (
  id                      uuid,
  display_name            text,
  email                   text,
  phone                   text,
  created_at              timestamptz,
  last_sign_in_at         timestamptz,
  banned_until            timestamptz,
  is_paid                 boolean,
  plan_id                 text,
  override_max_customers  integer,
  override_features       jsonb
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    coalesce(p.shop_name, p.display_name, u.raw_user_meta_data->>'name') as display_name,
    u.email,
    u.phone,
    u.created_at,
    u.last_sign_in_at,
    u.banned_until,
    (s.user_id is not null
       and coalesce(s.status,'active') <> 'canceled'
       and (s.current_period_end is null or s.current_period_end > now())
       and coalesce(s.plan_id,'free') <> 'free')          as is_paid,
    coalesce(s.plan_id, 'free')                            as plan_id,
    s.override_max_customers,
    s.override_features
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join lateral (
    select * from public.subscriptions x
     where x.user_id = u.id order by x.created_at desc limit 1
  ) s on true
  where public.is_current_user_admin()
  order by u.created_at desc;
$$;
grant execute on function public.admin_list_users_with_plan() to authenticated;

commit;

-- =============================================================================
-- After running: confirm with
--   select id, name, price_pkr, max_customers, features, sort_order
--   from public.plans order by sort_order;
-- =============================================================================
