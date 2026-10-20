begin;
create table public.marketplace_categories (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check (name = btrim(name) and char_length(name) between 1 and 20 and name <> '全部'),
 name_en text not null default '' check (char_length(name_en) <= 60),
 sort_order integer not null default 100 check (sort_order between 0 and 9999),
 active boolean not null default true
);
create unique index marketplace_categories_name_lower on public.marketplace_categories(lower(name));
insert into public.marketplace_categories(name,name_en,sort_order) values
 ('可爱动物','Cute animals',10),('花草自然','Nature',20),('像素游戏','Pixel games',30),('生活小物','Everyday objects',40),('其他','Other',50);
alter table public.marketplace_patterns drop constraint marketplace_patterns_category_check;
-- Names remain readable in existing URLs and JSON; renames cascade atomically to all works.
alter table public.marketplace_patterns add constraint marketplace_patterns_category_fkey
 foreign key(category) references public.marketplace_categories(name) on update cascade on delete restrict;
alter table public.marketplace_categories enable row level security;
revoke all on public.marketplace_categories from public,anon,authenticated,service_role;
grant select,insert,update on public.marketplace_categories to service_role;
commit;
