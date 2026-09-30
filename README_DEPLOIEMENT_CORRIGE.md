# AfriScope Media — refonte CMS v2

Cette version conserve les identifiants publics Supabase existants et ne place aucune clé OpenAI/service-role dans le navigateur.

## Architecture

- `index.html` : front public + espace administrateur.
- `config.js` : uniquement URL Supabase, project ref et clé publique existante.
- `supabase/cms-v2.sql` : crée le stockage éditorial normalisé `cms_site_state` + `cms_articles`, RLS, stockage images et analytics, puis importe **sans supprimer** la donnée legacy `site_data`.
- `supabase/functions/ai-editor` : génération IA authentifiée côté serveur avec OpenAI Responses API.
- `supabase/functions/og` : endpoint public de partage social basé sur `cms_articles`.
- `supabase/functions/track-visit` : collecte analytics côté serveur sans exposer de clé secrète.
- `scripts/build-site.mjs` : pré-rendu des pages `/article/<slug>/`, sitemap et configuration publique.
- `.github/workflows/pages.yml` : build + déploiement GitHub Pages.

## Pourquoi cette refonte

L'ancien fonctionnement sauvegardait les articles dans un objet JSON unique (`site_data`). Une erreur de cardinalité, un doublon ou un échec d'upsert pouvait donc laisser l'administration avec une donnée locale alors que les visiteurs lisaient une autre version.

Le CMS v2 donne aux articles leur propre table avec clé primaire, slug unique, statuts, dates de publication, corbeille et RLS. Après chaque enregistrement, l'éditeur reçoit la ligne réellement écrite par Supabase : aucun « faux succès » local n'est affiché.

## 1. Migration Supabase — à faire une seule fois

Dans **Supabase → SQL Editor**, exécutez :

`supabase/cms-v2.sql`

Le script :

1. crée les tables v2 ;
2. active les politiques RLS ;
3. importe la dernière version lisible de `site_data` ;
4. ne supprime aucune ligne de `site_data` ;
5. crée/réutilise le bucket `article-images` ;
6. prépare les analytics.

Si la migration a déjà été exécutée, elle est conçue pour être rejouable ; elle ne doit pas être combinée avec les anciens scripts de réparation de `site_data`.

## 2. Secrets Supabase

Conservez les secrets déjà présents. Vérifiez simplement :

- `OPENAI_API_KEY`
- `OPENAI_MODEL` = `gpt-5.6-luna` (ou votre modèle OpenAI déjà configuré)
- `PUBLIC_SITE_URL` = `https://afriscopemedia.github.io/asm`

La clé OpenAI reste uniquement dans les secrets des Edge Functions.

## 3. Déployer les Edge Functions

```bash
supabase link --project-ref xzgxabefcyxenxlymfur
supabase functions deploy ai-editor
supabase functions deploy og
supabase functions deploy track-visit
```

Ne mettez jamais `OPENAI_API_KEY`, `service_role` ou une Secret Key Supabase dans `config.js` ou GitHub Pages.

## 4. GitHub Actions

Dans **Settings → Secrets and variables → Actions** :

### Secrets

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (ou le secret public existant déjà utilisé par le dépôt)

### Variable

- `PUBLIC_SITE_URL` = `https://afriscopemedia.github.io/asm`

Puis laissez GitHub Pages utiliser **GitHub Actions** comme source de publication.

## 5. Vérification fonctionnelle

Après migration et déploiement :

1. ouvrir `/asm/` ;
2. ouvrir `/asm/admin` ;
3. se connecter avec le compte Supabase Auth existant ;
4. créer un brouillon ;
5. générer un article avec IA ;
6. enregistrer ;
7. publier ;
8. ouvrir l'URL `/asm/article/<slug>/` dans une fenêtre privée ;
9. vérifier le titre, le texte et l'image ;
10. vérifier le partage via `functions/v1/og?slug=<slug>` ;
11. vérifier que le workflow GitHub Pages génère la page statique et le sitemap.

## Données sensibles

Les clés publiques Supabase sont destinées au navigateur et sont protégées par RLS. Les secrets Supabase/OpenAI restent côté Edge Functions, conformément au modèle de sécurité Supabase.
