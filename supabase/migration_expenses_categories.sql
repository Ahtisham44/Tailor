-- =============================================================================
-- Tailor365 — Other expenses, monthly report snapshots, custom categories
-- =============================================================================
-- Run once in the Supabase SQL editor (or via `supabase db push`).
-- Idempotent: safe to run more than once.
--
-- What it does
--   1. category_expenses: add `is_other` + `label`, make `category_id` nullable
--      so standalone recurring expenses (electricity, gas, rent) can be stored.
--   2. monthly_report_snapshots: new table to freeze each past month's totals.
--   3. item_categories: add `is_custom` + `meas_fields` (jsonb) so tailors can
--      add their own categories with a hand-picked set of measurement fields.
--   4. RLS for the new snapshots table (per-user, matches the app's user_id model).
-- =============================================================================

begin;

-- ── 1. category_expenses: support "other" (non-category) recurring expenses ──
alter table public.category_expenses
  add column if not exists is_other boolean not null default false,
  add column if not exists label    text;

-- "other" rows have no category; relax the FK column to allow NULL.
alter table public.category_expenses
  alter column category_id drop not null;

comment on column public.category_expenses.is_other is
  'true = standalone recurring shop expense (rent, electricity) not tied to a category';
comment on column public.category_expenses.label is
  'Display name for an "other" expense, e.g. "Electricity". NULL for category expenses.';


-- ── 2. monthly_report_snapshots: freeze a completed month''s totals ──────────
create table if not exists public.monthly_report_snapshots (
  id              bigserial primary key,
  user_id         uuid not null default auth.uid(),
  period          date    not null,             -- first day of the month, e.g. 2026-06-01
  total_revenue   numeric not null default 0,
  total_invoiced  numeric not null default 0,
  karigar_exp     numeric not null default 0,
  category_exp    numeric not null default 0,
  other_exp       numeric not null default 0,
  total_expenses  numeric not null default 0,
  total_income    numeric not null default 0,
  delivered_count integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (user_id, period)
);

comment on table public.monthly_report_snapshots is
  'Frozen monthly report totals so past months are immutable to later expense edits.';

-- Enable RLS + per-user policies (mirrors the app''s user_id-scoped model).
alter table public.monthly_report_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'monthly_report_snapshots'
      and policyname = 'mrs_select_own'
  ) then
    create policy mrs_select_own on public.monthly_report_snapshots
      for select using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'monthly_report_snapshots'
      and policyname = 'mrs_insert_own'
  ) then
    create policy mrs_insert_own on public.monthly_report_snapshots
      for insert with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'monthly_report_snapshots'
      and policyname = 'mrs_update_own'
  ) then
    create policy mrs_update_own on public.monthly_report_snapshots
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'monthly_report_snapshots'
      and policyname = 'mrs_delete_own'
  ) then
    create policy mrs_delete_own on public.monthly_report_snapshots
      for delete using (user_id = auth.uid());
  end if;
end $$;


-- ── 3. item_categories: custom categories with hand-picked measurement fields ─
alter table public.item_categories
  add column if not exists is_custom   boolean not null default false,
  add column if not exists meas_fields jsonb;

comment on column public.item_categories.is_custom is
  'true = tailor-created category (not one of the built-in CATS in config.js)';
comment on column public.item_categories.meas_fields is
  'For custom categories: array of selected measurement field keys, e.g. ["lambai_qamees","chaati","kamar"]';

commit;
