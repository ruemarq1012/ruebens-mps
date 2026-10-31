-- Rueben's MPS: database schema, security rules and helper functions.
-- Run once in Supabase: SQL Editor -> New query -> paste this file -> Run.
-- Safe to run again: it only creates what is missing and refreshes functions and rules.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Who may use the app. Only emails listed here can see or change anything.
create table if not exists public.members (
  email        text primary key check (email = lower(email)),
  display_name text not null,
  role         text not null default 'member' check (role in ('admin', 'member')),
  created_at   timestamptz not null default now()
);

-- Every meal that has ever been on a menu (reused across weeks, so ratings and favorites carry over).
create table if not exists public.meals (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  style         text not null default 'express' check (style in ('oven', 'express', 'involved')),
  cook_minutes  int  not null default 30,
  servings      int  not null default 4,
  description   text not null default '',
  included      text[] not null default '{}',
  on_the_side   text,
  image_url     text,
  image_credit  text,
  source_name   text,
  source_url    text,
  ingredients   jsonb not null default '[]',   -- [{ "group": "Glaze" | null, "items": ["3 tbsp honey", ...] }]
  steps         jsonb not null default '[]',   -- ["Heat the oven to 425°F...", ...]
  shopping      jsonb not null default '[]',   -- [{ "name", "qty", "unit", "note", "section", "pantry" }]
  leftovers     text,
  created_at    timestamptz not null default now()
);

create table if not exists public.weeks (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  starts_on  date not null unique,
  pick_by    date,
  status     text not null default 'picking' check (status in ('picking', 'locked', 'done')),
  created_at timestamptz not null default now()
);

-- Which meals are on a week's menu, which were chosen, and the cooking order.
create table if not exists public.week_meals (
  week_id    uuid not null references public.weeks (id) on delete cascade,
  meal_id    uuid not null references public.meals (id) on delete cascade,
  position   int  not null default 0,
  chosen     boolean not null default false,
  cook_order int,
  cooked_at  timestamptz,
  primary key (week_id, meal_id)
);

create table if not exists public.picks (
  week_id      uuid not null references public.weeks (id) on delete cascade,
  meal_id      uuid not null references public.meals (id) on delete cascade,
  member_email text not null references public.members (email) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (week_id, meal_id, member_email)
);

create table if not exists public.ratings (
  week_id      uuid not null references public.weeks (id) on delete cascade,
  meal_id      uuid not null references public.meals (id) on delete cascade,
  member_email text not null references public.members (email) on delete cascade,
  stars        int  not null check (stars between 1 and 5),
  make_again   boolean,
  comment      text,
  updated_at   timestamptz not null default now(),
  primary key (week_id, meal_id, member_email)
);

create table if not exists public.favorites (
  meal_id      uuid not null references public.meals (id) on delete cascade,
  member_email text not null references public.members (email) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (meal_id, member_email)
);

-- "Anything to swap, skip or request?" — one note per person per week.
create table if not exists public.notes (
  week_id      uuid not null references public.weeks (id) on delete cascade,
  member_email text not null references public.members (email) on delete cascade,
  body         text not null default '',
  updated_at   timestamptz not null default now(),
  primary key (week_id, member_email)
);

create table if not exists public.grocery_items (
  id         uuid primary key default gen_random_uuid(),
  week_id    uuid not null references public.weeks (id) on delete cascade,
  section    text not null default 'Other',
  name       text not null,
  qty        numeric,
  unit       text not null default '',
  note       text,
  pantry     boolean not null default false,
  meals      text[] not null default '{}',
  checked    boolean not null default false,
  checked_by text,
  position   int not null default 0
);
create index if not exists grocery_items_week_idx on public.grocery_items (week_id);
create index if not exists picks_member_idx on public.picks (member_email);
create index if not exists picks_meal_idx on public.picks (meal_id);
create index if not exists ratings_member_idx on public.ratings (member_email);
create index if not exists ratings_meal_idx on public.ratings (meal_id);
create index if not exists favorites_member_idx on public.favorites (member_email);
create index if not exists notes_member_idx on public.notes (member_email);
create index if not exists week_meals_meal_idx on public.week_meals (meal_id);

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------

create or replace function public.jwt_email() returns text
language sql stable set search_path = '' as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where email = public.jwt_email())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where email = public.jwt_email() and role = 'admin')
$$;

-- Lets the sign-in screen say "this app is invite-only" before sending a code.
create or replace function public.can_sign_in(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where email = lower(trim(p_email)))
$$;

-- ---------------------------------------------------------------------------
-- Weekly workflow (internal functions do the work; public wrappers check permissions)
-- ---------------------------------------------------------------------------

create or replace function public._build_groceries(p_week uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from grocery_items where week_id = p_week;

  insert into grocery_items (week_id, section, name, qty, unit, note, pantry, meals, position)
  select p_week,
         case when bool_or(x.pantry) then 'Pantry' else min(x.section) end,
         min(x.name),
         sum(x.qty),
         x.unit,
         string_agg(distinct x.note, '; '),
         bool_or(x.pantry),
         array_agg(distinct x.meal_name),
         (row_number() over (order by min(x.name)))::int
  from (
    select coalesce(nullif(s ->> 'section', ''), 'Other')            as section,
           trim(s ->> 'name')                                        as name,
           nullif(s ->> 'qty', '')::numeric                          as qty,
           coalesce(s ->> 'unit', '')                                as unit,
           nullif(s ->> 'note', '')                                  as note,
           coalesce((s ->> 'pantry')::boolean, false)                as pantry,
           m.name                                                    as meal_name
    from week_meals wm
    join meals m on m.id = wm.meal_id
    cross join lateral jsonb_array_elements(m.shopping) s
    where wm.week_id = p_week and wm.chosen
  ) x
  group by lower(x.name), x.unit;
end $$;

create or replace function public._set_groceries(p_week uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from grocery_items where week_id = p_week;
  insert into grocery_items (week_id, section, name, qty, unit, note, pantry, meals, position)
  select p_week,
         case when coalesce((i ->> 'pantry')::boolean, false) then 'Pantry'
              else coalesce(nullif(i ->> 'section', ''), 'Other') end,
         i ->> 'name',
         nullif(i ->> 'qty', '')::numeric,
         coalesce(i ->> 'unit', ''),
         nullif(i ->> 'note', ''),
         coalesce((i ->> 'pantry')::boolean, false),
         coalesce(array(select jsonb_array_elements_text(i -> 'meals')), '{}'),
         n::int
  from jsonb_array_elements(p_items) with ordinality as t(i, n);
end $$;

create or replace function public._lock_week(p_week uuid, p_meals uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  update week_meals set chosen = (meal_id = any (p_meals)), cook_order = null where week_id = p_week;
  update week_meals wm
     set cook_order = o.rn
    from (select meal_id, row_number() over (order by position) as rn
            from week_meals where week_id = p_week and chosen) o
   where wm.week_id = p_week and wm.meal_id = o.meal_id;
  update weeks set status = 'locked' where id = p_week;
  perform public._build_groceries(p_week);
end $$;

create or replace function public._import_week(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_week uuid;
  v_meal uuid;
  m      jsonb;
  pos    int := 0;
begin
  if p -> 'week' ->> 'starts_on' is null or jsonb_typeof(p -> 'meals') is distinct from 'array' then
    raise exception 'Menu needs week.starts_on and a meals list';
  end if;

  insert into weeks (label, starts_on, pick_by, status)
  values (p -> 'week' ->> 'label', (p -> 'week' ->> 'starts_on')::date,
          nullif(p -> 'week' ->> 'pick_by', '')::date, 'picking')
  on conflict (starts_on) do update set label = excluded.label, pick_by = excluded.pick_by
  returning id into v_week;

  update weeks set status = 'done'
   where starts_on < (p -> 'week' ->> 'starts_on')::date and status <> 'done';

  delete from week_meals where week_id = v_week;

  for m in select * from jsonb_array_elements(p -> 'meals') loop
    insert into meals (slug, name, style, cook_minutes, servings, description, included, on_the_side,
                       image_url, image_credit, source_name, source_url, ingredients, steps, shopping, leftovers)
    values (m ->> 'slug', m ->> 'name', coalesce(m ->> 'style', 'express'),
            coalesce((m ->> 'cook_minutes')::int, 30), coalesce((m ->> 'servings')::int, 4),
            coalesce(m ->> 'description', ''),
            coalesce(array(select jsonb_array_elements_text(m -> 'included')), '{}'),
            m ->> 'on_the_side', m ->> 'image_url', m ->> 'image_credit', m ->> 'source_name', m ->> 'source_url',
            coalesce(m -> 'ingredients', '[]'), coalesce(m -> 'steps', '[]'), coalesce(m -> 'shopping', '[]'),
            m ->> 'leftovers')
    on conflict (slug) do update set
      name = excluded.name, style = excluded.style, cook_minutes = excluded.cook_minutes,
      servings = excluded.servings, description = excluded.description, included = excluded.included,
      on_the_side = excluded.on_the_side,
      image_url = coalesce(excluded.image_url, meals.image_url),
      image_credit = coalesce(excluded.image_credit, meals.image_credit),
      source_name = excluded.source_name, source_url = excluded.source_url,
      ingredients = case when jsonb_array_length(excluded.ingredients) > 0 then excluded.ingredients else meals.ingredients end,
      steps = case when jsonb_array_length(excluded.steps) > 0 then excluded.steps else meals.steps end,
      shopping = case when jsonb_array_length(excluded.shopping) > 0 then excluded.shopping else meals.shopping end,
      leftovers = coalesce(excluded.leftovers, meals.leftovers)
    returning id into v_meal;

    insert into week_meals (week_id, meal_id, position) values (v_week, v_meal, pos);
    pos := pos + 1;
  end loop;

  if jsonb_typeof(p -> 'chosen') = 'array' and jsonb_array_length(p -> 'chosen') > 0 then
    perform public._lock_week(v_week, array(
      select ml.id from meals ml join jsonb_array_elements_text(p -> 'chosen') c(slug) on c.slug = ml.slug));
    if jsonb_typeof(p -> 'cook_order') = 'array' then
      update week_meals wm set cook_order = o.n
        from meals ml, jsonb_array_elements_text(p -> 'cook_order') with ordinality as o(slug, n)
       where ml.slug = o.slug and wm.meal_id = ml.id and wm.week_id = v_week and wm.chosen;
    end if;
    if jsonb_typeof(p -> 'groceries') = 'array' then
      perform public._set_groceries(v_week, p -> 'groceries');
    end if;
  else
    update week_meals set chosen = false where week_id = v_week;
    delete from grocery_items where week_id = v_week;
    update weeks set status = 'picking' where id = v_week;
  end if;

  return v_week;
end $$;

-- Public wrappers the app calls ------------------------------------------------

create or replace function public.load_week(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the kitchen admin can load a menu'; end if;
  return public._import_week(p);
end $$;

create or replace function public.lock_week(p_week uuid, p_meals uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the kitchen admin can lock meals'; end if;
  perform public._lock_week(p_week, p_meals);
end $$;

create or replace function public.reopen_week(p_week uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the kitchen admin can reopen picking'; end if;
  update week_meals set chosen = false, cook_order = null, cooked_at = null where week_id = p_week;
  delete from grocery_items where week_id = p_week;
  update weeks set status = 'picking' where id = p_week;
end $$;

create or replace function public.set_groceries(p_week uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the kitchen admin can replace the grocery list'; end if;
  perform public._set_groceries(p_week, p_items);
end $$;

create or replace function public.mark_cooked(p_week uuid, p_meal uuid, p_cooked boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'Not a member'; end if;
  update week_meals set cooked_at = case when p_cooked then coalesce(cooked_at, now()) else null end
   where week_id = p_week and meal_id = p_meal;
end $$;

revoke all on function public._build_groceries(uuid), public._set_groceries(uuid, jsonb),
  public._lock_week(uuid, uuid[]), public._import_week(jsonb) from public, anon, authenticated;
grant execute on function public.can_sign_in(text) to anon, authenticated;
grant execute on function public.load_week(jsonb), public.lock_week(uuid, uuid[]), public.reopen_week(uuid),
  public.set_groceries(uuid, jsonb), public.mark_cooked(uuid, uuid, boolean),
  public.is_member(), public.is_admin(), public.jwt_email() to authenticated;
revoke execute on function public.is_member(), public.is_admin(), public.jwt_email() from public, anon;
revoke all on function public.load_week(jsonb), public.lock_week(uuid, uuid[]), public.reopen_week(uuid),
  public.set_groceries(uuid, jsonb), public.mark_cooked(uuid, uuid, boolean) from public, anon;

-- ---------------------------------------------------------------------------
-- Row-level security: members see everything, change only their own picks,
-- ratings, favorites and notes; the admin manages menus and the household.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

do $$
declare t text;
begin
  foreach t in array array['members','meals','weeks','week_meals','picks','ratings','favorites','notes','grocery_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "members read" on public.%I', t);
    execute format('create policy "members read" on public.%I for select to authenticated using ((select public.is_member()))', t);
  end loop;

  foreach t in array array['members','meals','weeks','week_meals','grocery_items'] loop
    execute format('drop policy if exists "admin insert" on public.%I', t);
    execute format('drop policy if exists "admin delete" on public.%I', t);
    execute format('create policy "admin insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;

  foreach t in array array['members','meals','weeks','week_meals'] loop
    execute format('drop policy if exists "admin update" on public.%I', t);
    execute format('create policy "admin update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;

  foreach t in array array['picks','ratings','favorites','notes'] loop
    execute format('drop policy if exists "own insert" on public.%I', t);
    execute format('drop policy if exists "own update" on public.%I', t);
    execute format('drop policy if exists "own delete" on public.%I', t);
    execute format('create policy "own insert" on public.%I for insert to authenticated with check ((select public.is_member()) and member_email = (select public.jwt_email()))', t);
    execute format('create policy "own update" on public.%I for update to authenticated using (member_email = (select public.jwt_email())) with check ((select public.is_member()) and member_email = (select public.jwt_email()))', t);
    execute format('create policy "own delete" on public.%I for delete to authenticated using (member_email = (select public.jwt_email()))', t);
  end loop;
end $$;

-- Anyone in the household can tick grocery items off.
drop policy if exists "members check groceries" on public.grocery_items;
create policy "members check groceries" on public.grocery_items
  for update to authenticated using ((select public.is_member())) with check ((select public.is_member()));

-- ---------------------------------------------------------------------------
-- Live updates (grocery list, picks, ratings show up instantly on the other phone)
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['grocery_items','picks','ratings','week_meals','weeks','notes','favorites'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Meal photos (public images, only the admin can upload)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', true)
on conflict (id) do nothing;

drop policy if exists "admin uploads meal photos" on storage.objects;
create policy "admin uploads meal photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'meal-photos' and (select public.is_admin()));

drop policy if exists "admin manages meal photos" on storage.objects;
create policy "admin manages meal photos" on storage.objects
  for delete to authenticated using (bucket_id = 'meal-photos' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Household: add the kitchen admin first (replace with your own email and name).
-- insert into public.members (email, display_name, role) values ('you@example.com', 'Your name', 'admin');
-- Load a week from SQL (the app's Kitchen tab does the same thing):
-- select public._import_week($j$ { ...menu json... } $j$::jsonb);
