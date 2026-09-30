# AfriScope Media — Supabase update v2

Projet cible : `xzgxabefcyxenxlymfur`

Cette version remplace l'ancienne utilisation de `SUPABASE_SERVICE_ROLE_KEY` dans les Edge Functions. Elle utilise le système actuel de clés Supabase : `@supabase/server`, `SUPABASE_PUBLISHABLE_KEYS` et `SUPABASE_SECRET_KEYS`, qui sont injectés automatiquement par Supabase. **Ne créez pas de secret personnalisé dont le nom commence par `SUPABASE_`.**

Supabase conserve encore les anciennes variables `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` pour compatibilité, mais la nouvelle architecture recommandée utilise les clés publishable/secret. Les clés secrètes doivent rester côté serveur et ne jamais être placées dans `index.html`.

## Contenu

```text
supabase/
├── config.toml
├── setup.sql
├── README_DEPLOIEMENT.md
└── functions/
    ├── ai-editor/index.ts
    ├── track-visit/index.ts
    ├── og/index.ts
    └── daily-newsletter/index.ts
```

## 1. Base de données

Dans Supabase → SQL Editor, exécutez :

`setup.sql`

Le script :

- crée les tables privées de newsletter, messages et analytics ;
- active les politiques RLS ;
- crée/rend public en lecture le bucket `article-images` ;
- protège les écritures de `site_data` derrière une session authentifiée ;
- prépare `pg_cron`, `pg_net` et Vault ;
- retire de `site_data` les anciennes copies publiques de `subscribers`, `contactMessages` et `analytics`.

Le job Cron de newsletter reste volontairement commenté tant que les secrets Vault ne sont pas configurés.

## 2. Secrets Edge Functions à créer

Dans Supabase → Edge Functions → Secrets, créez uniquement ces secrets applicatifs :

- `OPENAI_API_KEY` : votre clé API OpenAI.
- `OPENAI_MODEL` : facultatif ; valeur recommandée : `gpt-5.6-luna`.
- `PUBLIC_SITE_URL` : URL publique exacte d'AfriScope Media, sans `/#/...`.
- `RESEND_API_KEY` : clé API Resend.
- `NEWSLETTER_FROM` : expéditeur vérifié chez Resend, par exemple `AfriScope Media <newsletter@votre-domaine.com>`.

**Ne créez pas** `SUPABASE_URL`, `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, etc. : ces variables sont fournies automatiquement par Supabase dans les Edge Functions.

## 3. Déployer les quatre fonctions

### Avec la CLI

Depuis le dossier qui contient `supabase/` :

```bash
supabase login
supabase link --project-ref xzgxabefcyxenxlymfur
supabase functions deploy ai-editor
supabase functions deploy track-visit
supabase functions deploy og
supabase functions deploy daily-newsletter
```

`config.toml` configure déjà les fonctions qui doivent être accessibles sans JWT utilisateur :

- `track-visit` : public ;
- `og` : public ;
- `daily-newsletter` : entrée HTTP publique au niveau JWT, mais elle exige une clé Supabase `secret:default` valide ;
- `ai-editor` : session utilisateur obligatoire.

Vous pouvez également créer/mettre à jour les fonctions directement depuis le Dashboard Supabase.

## 4. Fonction IA

`ai-editor` utilise `@supabase/server` pour vérifier la session Supabase de l'administrateur avant d'appeler OpenAI.

Le modèle par défaut est `gpt-5.6-luna`. Vous pouvez changer `OPENAI_MODEL` sans modifier le code.

La clé OpenAI reste uniquement dans les secrets Edge Functions.

## 5. Analytics

`track-visit` est une fonction publique volontairement non authentifiée. Elle utilise `ctx.supabaseAdmin` côté serveur pour insérer les événements dans `analytics_events` sans ouvrir l'INSERT de cette table au navigateur.

Le navigateur envoie notamment :

- page ;
- titre ;
- visitor ID ;
- session ID ;
- appareil ;
- référent.

La fonction ajoute, lorsqu'elle est disponible, pays/région/ville à partir de l'IP transmise par l'infrastructure réseau.

## 6. Open Graph

`og` est public et utilise la clé serveur injectée par Supabase via `@supabase/server`.

URL :

```text
https://xzgxabefcyxenxlymfur.supabase.co/functions/v1/og?slug=SLUG
```

Configurez `PUBLIC_SITE_URL` avec l'URL publique du site.

## 7. Newsletter quotidienne à 06:00

La fonction `daily-newsletter` accepte uniquement une clé Supabase secrète nommée `default`.

Dans Supabase → Settings → API Keys, récupérez la **Secret Key** actuelle (`sb_secret_...`). Ne la mettez pas dans le dépôt GitHub ni dans `index.html`.

Puis ouvrez Supabase → Database → Vault et créez deux secrets :

```text
Nom : afriscope_project_url
Valeur : https://xzgxabefcyxenxlymfur.supabase.co
```

```text
Nom : afriscope_secret_key
Valeur : votre clé secrète Supabase sb_secret_...
```

Ensuite, exécutez dans SQL Editor le bloc suivant :

```sql
select cron.schedule(
  'afriscope-daily-newsletter',
  '0 5 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'afriscope_project_url') || '/functions/v1/daily-newsletter',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'afriscope_secret_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

05:00 UTC correspond à 06:00 à Libreville.

Pour vérifier le job :

```sql
select * from cron.job where jobname = 'afriscope-daily-newsletter';
```

Pour vérifier les exécutions :

```sql
select * from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'afriscope-daily-newsletter')
order by start_time desc
limit 20;
```

## 8. Important : clés Supabase

La nouvelle architecture Supabase distingue :

- **Publishable key** (`sb_publishable_...`) : navigateur / client ;
- **Secret key** (`sb_secret_...`) : Edge Functions, serveurs, Cron et autres composants backend.

Les clés `anon` et `service_role` restent disponibles pendant la migration, mais elles sont en voie de dépréciation. Le code de ce package n'en dépend plus.

## 9. Après déploiement

Vérifiez dans le Dashboard :

1. Edge Functions : `ai-editor`, `track-visit`, `og`, `daily-newsletter` sont `ACTIVE`.
2. Secrets : les cinq secrets applicatifs ci-dessus existent.
3. API Keys : une Secret Key `sb_secret_...` existe.
4. Storage : le bucket `article-images` existe et est public en lecture.
5. Cron : `afriscope-daily-newsletter` existe et est planifié à `0 5 * * *`.
6. Authentication → URL Configuration : le Site URL correspond à l'URL publique réelle d'AfriScope Media et ne contient pas `localhost`.

## 10. Test rapide des fonctions

Après déploiement :

- `ai-editor` : tester depuis le panel d'administration après connexion ;
- `track-visit` : charger le site et vérifier une nouvelle ligne dans `analytics_events` ;
- `og` : ouvrir `https://xzgxabefcyxenxlymfur.supabase.co/functions/v1/og?slug=VOTRE-SLUG` ;
- `daily-newsletter` : ne pas appeler manuellement sans une clé secrète valide ; tester le job via Cron après configuration.

## 11. Sécurité

Ne publiez jamais :

- `sb_secret_...` ;
- une clé OpenAI ;
- une clé Resend ;
- les valeurs Vault ;
- un fichier `.env` contenant des secrets.

Le fichier `index.html` peut contenir une Publishable Key Supabase, mais jamais une Secret Key.
