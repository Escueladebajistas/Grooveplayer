-- Ejecuta TODO este archivo en Supabase > SQL Editor > New query.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default '',
  playlist_name text not null default 'General',
  storage_path text not null unique,
  size bigint not null default 0,
  mime_type text not null default 'audio/mpeg',
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
alter table public.tracks enable row level security;

drop policy if exists "Admins can read their own record" on public.admins;
create policy "Admins can read their own record" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Anyone can read tracks" on public.tracks;
create policy "Anyone can read tracks" on public.tracks
  for select to anon, authenticated using (true);

drop policy if exists "Admins can add tracks" on public.tracks;
create policy "Admins can add tracks" on public.tracks
  for insert to authenticated with check (
    exists (select 1 from public.admins where user_id = auth.uid())
  );

drop policy if exists "Admins can delete tracks" on public.tracks;
create policy "Admins can delete tracks" on public.tracks
  for delete to authenticated using (
    exists (select 1 from public.admins where user_id = auth.uid())
  );

grant select on public.tracks to anon, authenticated;
grant insert, delete on public.tracks to authenticated;
grant select on public.admins to authenticated;

-- Bucket público para que todos puedan reproducir el audio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music', 'music', true, 52428800,
  array['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/flac','audio/aac'])
on conflict (id) do update set public = true;

-- Cualquiera puede escuchar/descargar los archivos del bucket.
drop policy if exists "Public can listen to music" on storage.objects;
create policy "Public can listen to music" on storage.objects
  for select to anon, authenticated using (bucket_id = 'music');

-- Solo la cuenta agregada a public.admins puede subir y borrar archivos.
drop policy if exists "Admins can upload music" on storage.objects;
create policy "Admins can upload music" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'music' and exists (select 1 from public.admins where user_id = auth.uid())
  );

drop policy if exists "Admins can delete music" on storage.objects;
create policy "Admins can delete music" on storage.objects
  for delete to authenticated using (
    bucket_id = 'music' and exists (select 1 from public.admins where user_id = auth.uid())
  );

-- PASO FINAL: después de crear tu usuario en Authentication > Users,
-- copia su UUID y ejecuta en SQL Editor:
-- insert into public.admins (user_id) values ('PEGA-AQUI-EL-UUID-DE-TU-USUARIO');
