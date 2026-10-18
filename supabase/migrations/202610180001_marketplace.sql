begin;
create table public.marketplace_patterns (
  id uuid primary key,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  author text not null check (char_length(author) between 1 and 30),
  description text not null default '' check (char_length(description) <= 1000),
  category text not null check (category in ('可爱动物', '花草自然', '像素游戏', '生活小物', '其他')),
  project jsonb not null check (jsonb_typeof(project) = 'object'),
  created_at timestamptz not null default now()
);
create index marketplace_patterns_created on public.marketplace_patterns (created_at desc, id);
create index marketplace_patterns_category on public.marketplace_patterns (category, created_at desc);
alter table public.marketplace_patterns enable row level security;
revoke all on public.marketplace_patterns from anon, authenticated, service_role;
grant select, insert on public.marketplace_patterns to service_role;

-- Only the server key can execute this function. Search is literal, not SQL or filter syntax.
create function public.list_marketplace_patterns(
  search_query text default '', filter_category text default null,
  page_number integer default 1, page_size integer default 24
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with filtered as (
    select * from public.marketplace_patterns
    where (filter_category is null or category = filter_category)
      and (coalesce(search_query, '') = '' or strpos(lower(title || ' ' || author || ' ' || description), lower(search_query)) > 0)
  ), paged as (
    select * from filtered order by created_at desc, id
    limit greatest(1, least(page_size, 100))
    offset (greatest(page_number, 1)::bigint - 1) * greatest(1, least(page_size, 100))
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(paged) order by created_at desc, id) from paged), '[]'::jsonb),
    'total', (select count(*) from filtered)
  );
$$;
revoke all on function public.list_marketplace_patterns(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.list_marketplace_patterns(text, text, integer, integer) to service_role;
commit;
