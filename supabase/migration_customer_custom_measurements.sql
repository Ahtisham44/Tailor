-- Custom labels live on versioned measurement rows, so historical labels stay intact.

alter table public.customer_measurement_values
  add column if not exists custom_label text,
  add column if not exists display_order integer;

create index if not exists customer_measurement_values_measurement_id_idx
  on public.customer_measurement_values (measurement_id);

create or replace function public.save_customer_measurement_version(
  p_customer_item_id text,
  p_values jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.customer_items%rowtype;
  v_current public.customer_measurements%rowtype;
  v_new_id public.customer_measurements.id%type;
  v_version integer;
  v_existing jsonb;
  v_requested jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'array' then
    raise exception 'Measurement values must be an array';
  end if;

  -- Lock the owned category to serialize competing saves for this customer.
  select * into v_item
    from public.customer_items
   where id = p_customer_item_id::bigint and user_id = (select auth.uid())
   for update;
  if not found then
    raise exception 'Customer category not found';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_values) as r(value)
    where jsonb_typeof(r.value) <> 'object'
       or nullif(r.value->>'measurement_key', '') is null
       or (left(r.value->>'measurement_key', 7) = 'custom_'
           and nullif(btrim(r.value->>'custom_label'), '') is null
           and nullif(btrim(coalesce(r.value->>'value', '')), '') is not null)
  ) then
    raise exception 'Every custom field needs a name and key';
  end if;
  if (select count(*) from jsonb_array_elements(p_values)) <>
     (select count(distinct r.value->>'measurement_key') from jsonb_array_elements(p_values) as r(value)) then
    raise exception 'Duplicate measurement keys';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'measurement_key', entry.payload->>'measurement_key',
      'value', coalesce(entry.payload->>'value', ''),
      'custom_label', case when left(entry.payload->>'measurement_key', 7) = 'custom_' then entry.payload->>'custom_label' else null end,
      'display_order', case when left(entry.payload->>'measurement_key', 7) = 'custom_' then (entry.payload->>'display_order')::integer else null end
    ) order by entry.payload->>'measurement_key'), '[]'::jsonb)
    into v_requested
    from jsonb_array_elements(p_values) as entry(payload);

  select * into v_current
    from public.customer_measurements
   where customer_item_id = v_item.id and is_current = true
   order by version desc limit 1;

  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'measurement_key', measurement_key,
      'value', coalesce(value::text, ''),
      'custom_label', custom_label,
      'display_order', display_order
    ) order by measurement_key), '[]'::jsonb)
      into v_existing
      from public.customer_measurement_values
     where measurement_id = v_current.id;
    if v_existing = v_requested then return false; end if;
  elsif v_requested = '[]'::jsonb then
    return false;
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.customer_measurements where customer_item_id = v_item.id;

  update public.customer_measurements
     set is_current = false
   where customer_item_id = v_item.id and is_current = true;

  insert into public.customer_measurements (customer_item_id, user_id, version, is_current, taken_at)
  values (v_item.id, (select auth.uid()), v_version, true, now())
  returning id into v_new_id;

  insert into public.customer_measurement_values
    (measurement_id, user_id, measurement_key, value, custom_label, display_order)
  select v_new_id, (select auth.uid()),
         entry.payload->>'measurement_key', coalesce(entry.payload->>'value', ''),
         case when left(entry.payload->>'measurement_key', 7) = 'custom_' then entry.payload->>'custom_label' else null end,
         case when left(entry.payload->>'measurement_key', 7) = 'custom_' then (entry.payload->>'display_order')::integer else null end
    from jsonb_array_elements(p_values) as entry(payload);

  return true;
end;
$$;

revoke all on function public.save_customer_measurement_version(text, jsonb) from public, anon;
grant execute on function public.save_customer_measurement_version(text, jsonb) to authenticated;
