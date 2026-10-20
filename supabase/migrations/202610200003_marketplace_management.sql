begin;
alter table public.marketplace_patterns
 add column status text not null default 'published' check (status in ('published','hidden')),
 add column beads integer not null default 0,
 add column colors integer not null default 0,
 add column continuity integer not null default 0 check (continuity between 0 and 100);

-- Count right/down edges once. Empty cells are excluded from the denominator.
create function public.marketplace_metrics(p jsonb) returns table(beads integer, colors integer, continuity integer)
language sql immutable set search_path = '' as $$
 with cells as (
  select value #>> '{}' as color, ordinality::integer - 1 as i
  from jsonb_array_elements(p->'cells') with ordinality
 ), edges as (
  select a.color = n.color as same from cells a
  cross join lateral (values
   (case when a.i % (p->>'width')::integer < (p->>'width')::integer - 1 then p->'cells'->>(a.i + 1) end),
   (p->'cells'->>(a.i + (p->>'width')::integer))
  ) n(color)
  where a.color is not null and n.color is not null
 )
 select (select count(color)::integer from cells), (select count(distinct color)::integer from cells),
 coalesce((select round(100.0 * count(*) filter(where same) / nullif(count(*),0))::integer from edges),0);
$$;
create function public.set_marketplace_metrics() returns trigger language plpgsql set search_path = '' as $$
begin
 select m.beads, m.colors, m.continuity into new.beads, new.colors, new.continuity from public.marketplace_metrics(new.project) m;
 return new;
end $$;
create trigger marketplace_metrics before insert or update of project on public.marketplace_patterns
 for each row execute function public.set_marketplace_metrics();
update public.marketplace_patterns set project = project;
create index marketplace_patterns_status on public.marketplace_patterns(status,created_at desc);
grant update on public.marketplace_patterns to service_role;

-- Replace the original signature to keep PostgREST RPC dispatch unambiguous.
drop function public.list_marketplace_patterns(text,text,integer,integer);
create function public.list_marketplace_patterns(
 search_query text default '', filter_category text default null,
 page_number integer default 1, page_size integer default 24,
 bead_range text default null, color_range text default null, continuity_range text default null,
 sort_order text default 'new', include_hidden boolean default false, filter_status text default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
 with filtered as (
  select * from public.marketplace_patterns
  where (case when include_hidden then filter_status is null or status = filter_status else status = 'published' end)
   and (filter_category is null or category = filter_category)
   and (coalesce(search_query,'') = '' or strpos(lower(title || ' ' || author || ' ' || description),lower(search_query)) > 0)
   and (bead_range is null or case bead_range when 'small' then beads <= 500 when 'medium' then beads between 501 and 2000 when 'large' then beads between 2001 and 5000 when 'huge' then beads > 5000 else false end)
   and (color_range is null or case color_range when 'few' then colors <= 5 when 'medium' then colors between 6 and 15 when 'many' then colors > 15 else false end)
   and (continuity_range is null or case continuity_range when 'scattered' then continuity < 50 when 'mixed' then continuity between 50 and 79 when 'continuous' then continuity >= 80 else false end)
 ), ranked as (
  select *, row_number() over (order by
   case when sort_order = 'small' then beads end asc,
   case when sort_order = 'colors' then colors end asc,
   case when sort_order = 'continuous' then continuity end desc,
   created_at desc,id) as rank from filtered
 ), paged as (
  select * from ranked order by rank limit greatest(1,least(page_size,100))
  offset (greatest(page_number,1)::bigint - 1) * greatest(1,least(page_size,100))
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(paged) - 'rank' order by rank) from paged),'[]'::jsonb),'total',(select count(*) from filtered));
$$;
revoke all on function public.marketplace_metrics(jsonb), public.set_marketplace_metrics(), public.list_marketplace_patterns(text,text,integer,integer,text,text,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.marketplace_metrics(jsonb), public.set_marketplace_metrics(), public.list_marketplace_patterns(text,text,integer,integer,text,text,text,text,boolean,text) to service_role;
commit;
