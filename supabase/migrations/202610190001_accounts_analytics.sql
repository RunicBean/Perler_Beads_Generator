create table public.app_accounts (
 id uuid primary key default gen_random_uuid(), username text unique not null,
 password_hash text not null, created_at timestamptz not null default now()
);
create table public.app_sessions (
 token_hash text primary key, user_id uuid not null references public.app_accounts(id) on delete cascade,
 expires_at timestamptz not null default now() + interval '7 days'
);
create table public.app_events (
 id bigint generated always as identity primary key, name text not null,
 visitor_id text not null, session_id text not null, source text not null default '',
 created_at timestamptz not null default now()
);
create index on public.app_events(created_at);
create index on public.app_events(visitor_id, created_at);
create or replace function public.limit_app_events() returns trigger language plpgsql set search_path = public as $$
begin
 perform pg_advisory_xact_lock(hashtext(new.visitor_id));
 if new.name = 'auth_attempt' then
  if (select count(*) from app_events where visitor_id = new.visitor_id and name = 'auth_attempt' and created_at > now() - interval '15 minutes') >= 10 then
   raise exception 'Too many attempts';
  end if;
 elsif (select count(*) from app_events where visitor_id = new.visitor_id and created_at > now() - interval '1 minute') >= 60 then
  raise exception 'Too many events';
 end if;
 return new;
end $$;
create trigger app_event_limit before insert on public.app_events for each row execute function public.limit_app_events();
create or replace function public.app_statistics(days integer default 7) returns jsonb language sql security invoker set search_path = public as $$
 with e as (select *, (created_at at time zone 'Asia/Shanghai')::date as day from app_events
 where created_at >= (((now() at time zone 'Asia/Shanghai')::date - (days-1))::timestamp at time zone 'Asia/Shanghai') and name <> 'auth_attempt'),
 daily as (select d::date as day, count(e.id) filter (where name='page_view') as pv,
 count(distinct visitor_id) filter (where name='page_view') as uv from generate_series((now() at time zone 'Asia/Shanghai')::date - (days-1), (now() at time zone 'Asia/Shanghai')::date, interval '1 day') d left join e on e.day=d::date group by d),
 features as (select name, count(*) as count from e where name <> 'page_view' group by name),
 sources as (select coalesce(nullif(source,''),'直接访问') as source, count(*) as count from e where name='page_view' group by source)
 select jsonb_build_object('pv',count(*) filter(where name='page_view'),'uv',count(distinct visitor_id) filter(where name='page_view'),
 'sessions',count(distinct session_id) filter(where name='page_view'),
 'registrations',(select count(*) from app_accounts where created_at >= (((now() at time zone 'Asia/Shanghai')::date - (days-1))::timestamp at time zone 'Asia/Shanghai')),
 'daily',coalesce((select jsonb_agg(daily order by day) from daily),'[]'),
 'features',coalesce((select jsonb_agg(features order by count desc) from features),'[]'),
 'sources',coalesce((select jsonb_agg(sources order by count desc) from sources),'[]')) from e;
$$;
alter table public.app_accounts enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_events enable row level security;
revoke all on public.app_accounts, public.app_sessions, public.app_events from anon, authenticated;
revoke execute on function public.app_statistics(integer) from public, anon, authenticated;
grant all on public.app_accounts, public.app_sessions, public.app_events to service_role;
grant usage, select on sequence public.app_events_id_seq to service_role;
grant execute on function public.app_statistics(integer) to service_role;
