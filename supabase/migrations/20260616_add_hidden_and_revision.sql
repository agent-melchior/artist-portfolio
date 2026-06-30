alter table if exists works
  add column if not exists hidden boolean not null default false;

insert into site_settings(key, value)
values ('dataRevision', '0')
on conflict (key) do nothing;
