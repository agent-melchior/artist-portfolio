-- Run this in the Supabase SQL editor once for the portfolio prototype.

create table if not exists site_settings (
  key text primary key,
  value text not null
);

create table if not exists menu_items (
  id text primary key,
  label text not null,
  slug text not null unique,
  type text not null check (type in ('page', 'category')),
  sort_order integer not null default 0
);

create table if not exists pages (
  slug text primary key,
  title text not null,
  body text not null default ''
);

create table if not exists works (
  id text primary key,
  category text not null,
  title text not null,
  year text not null default '',
  material text not null default '',
  description text not null default '',
  image text not null default '',
  sort_order integer not null default 0
);

create index if not exists menu_items_sort_order_idx on menu_items(sort_order);
create index if not exists works_category_sort_order_idx on works(category, sort_order);

insert into site_settings(key, value)
values ('siteTitle', 'Artist Portfolio')
on conflict (key) do nothing;

insert into menu_items(id, label, slug, type, sort_order)
values
  ('contact', 'Contact', 'contact', 'page', 0),
  ('prototypes', 'Prototypes', 'prototypes', 'category', 1),
  ('timelapse', 'Timelapse', 'timelapse', 'category', 2),
  ('cv', 'CV', 'cv', 'page', 3)
on conflict (id) do nothing;

insert into pages(slug, title, body)
values
  ('contact', 'Contact', 'For enquiries, exhibitions, and commissions:\n\nemail@example.com'),
  ('cv', 'CV', 'Selected exhibitions, education, residencies, and publications can be edited from the admin.')
on conflict (slug) do nothing;

-- Storage bucket for portfolio images.
insert into storage.buckets (id, name, public)
values ('portfolio-images', 'portfolio-images', true)
on conflict (id) do nothing;

-- Public read policy for images in this bucket. Uploads are handled server-side with the service role key.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read portfolio images'
  ) then
    create policy "Public read portfolio images"
    on storage.objects for select
    using (bucket_id = 'portfolio-images');
  end if;
end $$;
