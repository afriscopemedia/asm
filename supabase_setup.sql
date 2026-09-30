-- ============================================================
-- AfriScope Media — configuration Supabase (à exécuter UNE FOIS)
-- Où l'exécuter : dans votre projet Supabase > SQL Editor > New query
-- ============================================================

-- 1. Table unique qui contient toutes les données du site
--    (articles, rubriques, auteurs, tags, publicité, abonnés, messages)
create table if not exists site_data (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. Active la sécurité au niveau des lignes (obligatoire sur Supabase)
alter table site_data enable row level security;

-- 3. Tout le monde (visiteurs anonymes) peut LIRE les données du site
create policy "Lecture publique"
  on site_data
  for select
  using (true);

-- 4. Seul un utilisateur connecté (votre compte admin) peut ÉCRIRE
create policy "Ecriture reservee a l administrateur connecte"
  on site_data
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- ÉTAPES SUIVANTES (dans l'interface Supabase, pas en SQL) :
--
-- A) Créez votre compte administrateur :
--    Authentication > Users > "Add user" > renseignez votre email
--    et un mot de passe, puis cochez "Auto Confirm User".
--
-- B) (recommandé) Empêchez la création de nouveaux comptes par
--    d'autres personnes :
--    Authentication > Settings > décochez "Allow new users to sign up".
--
-- C) Récupérez vos identifiants pour le site :
--    Project Settings > API > copiez "Project URL" et la clé "anon public"
--    (PAS la clé "service_role", qui doit rester secrète).
--
-- D) Collez ces deux valeurs dans index.html, dans les constantes
--    SUPABASE_URL et SUPABASE_ANON_KEY (juste après ADMIN_PASSWORD),
--    puis republiez le fichier sur GitHub Pages.
-- ============================================================
