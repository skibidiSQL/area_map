-- Статистика просмотров: выполните один раз в Supabase → SQL Editor.
create table if not exists public.events (
  id     text primary key,          -- уникальный id события (создаётся на устройстве)
  map_id text   not null,           -- карта
  kind   text   not null,           -- map | poi | pano | route
  target text   default '',         -- id точки / панорамы
  vid    text,                      -- анонимный id посетителя (случайный, хранится в браузере)
  own    boolean default false,     -- просмотр сделал организатор
  ts     bigint not null            -- время, мс
);
create index if not exists events_map_ts on public.events (map_id, ts desc);

alter table public.events enable row level security;
-- как и для таблицы maps, доступ идёт по публичному ключу без входа в аккаунт
create policy "events insert" on public.events for insert to anon, authenticated with check (true);
create policy "events select" on public.events for select to anon, authenticated using (true);
