-- AfriScope Media — migration Supabase
-- À exécuter dans SQL Editor après sauvegarde de la base.

create extension if not exists pgcrypto;

-- Le contenu public reste dans site_data. Les données privées ne doivent PAS y rester.
update public.site_data
set data = data - 'subscribers' - 'contactMessages' - 'analytics'
where id = 'main';

-- 1) Abonnés newsletter
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "newsletter insert public" on public.newsletter_subscribers;
drop policy if exists "newsletter read authenticated" on public.newsletter_subscribers;
create policy "newsletter insert public" on public.newsletter_subscribers
  for insert to anon, authenticated with check (length(email) between 5 and 320);
create policy "newsletter read authenticated" on public.newsletter_subscribers
  for select to authenticated using (true);

-- 2) Messages de contact
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  message text not null,
  email text not null,
  phone text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
drop policy if exists "contact insert public" on public.contact_messages;
drop policy if exists "contact read authenticated" on public.contact_messages;
create policy "contact insert public" on public.contact_messages
  for insert to anon, authenticated with check (length(message) between 1 and 10000);
create policy "contact read authenticated" on public.contact_messages
  for select to authenticated using (true);

-- 3) Analytics côté serveur
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  path text not null,
  title text,
  visitor_id text,
  session_id text,
  device text,
  referrer text,
  country text,
  region text,
  city text
);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);
create index if not exists analytics_events_visitor_id_idx on public.analytics_events(visitor_id);

alter table public.analytics_events enable row level security;
drop policy if exists "analytics read authenticated" on public.analytics_events;
create policy "analytics read authenticated" on public.analytics_events
  for select to authenticated using (true);
-- Aucun INSERT public : track-visit utilise la clé service côté Edge Function.

-- 4) Stockage des images d'articles
insert into storage.buckets (id,name,public)
values ('article-images','article-images',true)
on conflict (id) do update set public=true;

drop policy if exists "article images public read" on storage.objects;
drop policy if exists "article images authenticated insert" on storage.objects;
drop policy if exists "article images authenticated update" on storage.objects;
drop policy if exists "article images authenticated delete" on storage.objects;
create policy "article images public read" on storage.objects
  for select using (bucket_id='article-images');
create policy "article images authenticated insert" on storage.objects
  for insert to authenticated with check (bucket_id='article-images');
create policy "article images authenticated update" on storage.objects
  for update to authenticated using (bucket_id='article-images') with check (bucket_id='article-images');
create policy "article images authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id='article-images');

-- 5) site_data : lecture publique, écriture authentifiée.
alter table public.site_data enable row level security;
drop policy if exists "site data public read" on public.site_data;
drop policy if exists "site data authenticated insert" on public.site_data;
drop policy if exists "site data authenticated update" on public.site_data;
drop policy if exists "site data authenticated delete" on public.site_data;
create policy "site data public read" on public.site_data
  for select to anon, authenticated using (true);
create policy "site data authenticated insert" on public.site_data
  for insert to authenticated with check (true);
create policy "site data authenticated update" on public.site_data
  for update to authenticated using (true) with check (true);
create policy "site data authenticated delete" on public.site_data
  for delete to authenticated using (true);

-- 6) Cron : récapitulatif des articles de la veille à 06:00 heure du Gabon.
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Remplacez PROJECT_REF et PUBLISHABLE_KEY ci-dessous après déploiement de la fonction.
-- Heure Supabase Cron = UTC : 05:00 UTC = 06:00 Africa/Libreville.
-- select cron.schedule(
--   'afriscope-daily-newsletter',
--   '0 5 * * *',
--   $$select net.http_post(
--     url:='https://PROJECT_REF.supabase.co/functions/v1/daily-newsletter',
--     headers:='{"Content-Type":"application/json","apikey":"PUBLISHABLE_KEY"}'::jsonb,
--     body:='{}'::jsonb
--   )$$
-- );
