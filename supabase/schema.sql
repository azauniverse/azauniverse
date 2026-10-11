-- AZA UNIVERSE: profiles + online leaderboard + bounded score submission.
-- Run once in Supabase Dashboard > SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  total_points integer not null default 0 check (total_points >= 0),
  best_reaction_ms integer check (best_reaction_ms is null or best_reaction_ms between 1 and 60000),
  created_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 3 and 20)
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles ((lower(username)));

create table if not exists public.score_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('quiz', 'reaction')),
  amount integer not null check (amount between 1 and 50),
  reaction_ms integer check (reaction_ms is null or reaction_ms between 100 and 3000),
  created_at timestamptz not null default now()
);

create index if not exists score_events_user_source_created_idx
  on public.score_events (user_id, source, created_at desc);

alter table public.profiles enable row level security;
alter table public.score_events enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.score_events to authenticated;

-- Public leaderboard may read only these public profile fields (no email is stored here).
drop policy if exists "Profiles visible for leaderboard" on public.profiles;
create policy "Profiles visible for leaderboard"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- A signed-in user can read only their own event history.
drop policy if exists "Users read own score events" on public.score_events;
create policy "Users read own score events"
  on public.score_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Create one public profile automatically when an auth user is created.
create or replace function public.handle_new_aza_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_username text;
begin
  v_base := coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'player');
  v_base := regexp_replace(v_base, '[^[:alnum:]_]', '', 'g');
  if char_length(v_base) < 3 then v_base := 'player'; end if;
  v_base := left(v_base, 16);
  v_username := v_base;
  if exists (select 1 from public.profiles p where lower(p.username) = lower(v_username)) then
    v_username := left(v_base, 11) || '_' || lower(substr(replace(new.id::text, '-', ''), 1, 8));
  end if;
  insert into public.profiles (id, username)
  values (new.id, v_username)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_aza_user() from public, anon, authenticated;
drop trigger if exists on_aza_auth_user_created on auth.users;
create trigger on_aza_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_aza_user();

-- Awards bounded points through an authenticated RPC. The browser cannot write scores directly.
-- Caps: max 50 points per quiz submission / 100 quiz points per rolling 24h;
--       max 25 points per reaction / 50 reaction points per rolling 24h.
create or replace function public.record_points(
  p_source text,
  p_amount integer,
  p_reaction_ms integer default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_daily_total integer := 0;
  v_daily_limit integer;
  v_max_event integer;
  v_awarded integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_source not in ('quiz', 'reaction') then
    raise exception 'Invalid score source';
  end if;
  if p_amount is null or p_amount < 1 then
    raise exception 'Invalid score amount';
  end if;

  if p_source = 'quiz' then
    v_daily_limit := 100;
    v_max_event := 50;
  else
    v_daily_limit := 50;
    v_max_event := 25;
    if p_reaction_ms is null or p_reaction_ms < 100 or p_reaction_ms > 3000 then
      raise exception 'Reaction time out of accepted range';
    end if;
  end if;
  if p_amount > v_max_event then
    raise exception 'Score amount exceeds per-event limit';
  end if;

  -- Serialize awards for the same profile so simultaneous calls cannot bypass daily caps.
  perform 1 from public.profiles p where p.id = v_user_id for update;

  select coalesce(sum(se.amount), 0)::integer
    into v_daily_total
    from public.score_events se
   where se.user_id = v_user_id
     and se.source = p_source
     and se.created_at >= pg_catalog.now() - interval '24 hours';

  v_awarded := least(p_amount, greatest(0, v_daily_limit - v_daily_total));
  if v_awarded <= 0 then
    return 0;
  end if;

  insert into public.score_events (user_id, source, amount, reaction_ms)
  values (v_user_id, p_source, v_awarded, case when p_source = 'reaction' then p_reaction_ms else null end);

  update public.profiles
     set total_points = total_points + v_awarded,
         best_reaction_ms = case
           when p_source = 'reaction' and (best_reaction_ms is null or p_reaction_ms < best_reaction_ms) then p_reaction_ms
           else best_reaction_ms
         end
   where id = v_user_id;

  return v_awarded;
end;
$$;

revoke all on function public.record_points(text, integer, integer) from public, anon;
grant execute on function public.record_points(text, integer, integer) to authenticated;

-- Note: this MVP limits point farming, but client-submitted quiz results are not fully anti-cheat.
-- A later hardening step can move question validation into a server-side Edge Function.
