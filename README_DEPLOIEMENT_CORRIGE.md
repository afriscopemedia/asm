# AfriScope Media — déploiement corrigé

## Architecture

- `index.html` : application publique + administration.
- `config.js` : configuration **publique uniquement** (URL Supabase + clé publishable).
- `supabase/functions/ai-editor` : authentification Supabase + appel OpenAI côté serveur.
- `supabase/functions/og` : métadonnées Open Graph pour le partage social.
- `scripts/build-site.mjs` : pré-rendu des pages d’articles pour que les crawlers voient immédiatement le titre, le chapô, l’image et le JSON-LD.
- `.github/workflows/pages.yml` : build/déploiement GitHub Pages à chaque push et toutes les heures.

## Secrets GitHub Actions

Dans GitHub → Settings → Secrets and variables → Actions :

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Dans Variables :

- `PUBLIC_SITE_URL` (ex. `https://afriscopemedia.github.io/asm` ou votre domaine)

Ne mettez jamais `OPENAI_API_KEY`, `sb_secret_...`, `service_role` ou Resend dans GitHub Pages ou `config.js`.

## Secrets Supabase Edge Functions

Configurer dans Supabase :

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (par exemple `gpt-5.6-luna`)
- `PUBLIC_SITE_URL`
- éventuellement les secrets déjà utilisés par `daily-newsletter`

Puis :

```bash
supabase link --project-ref xzgxabefcyxenxlymfur
supabase functions deploy ai-editor
supabase functions deploy og
supabase functions deploy track-visit
supabase functions deploy daily-newsletter
```

## GitHub Pages

Activez Settings → Pages → Source : **GitHub Actions**.

Le workflow reconstruit les pages statiques depuis `site_data`, génère `sitemap.xml`, puis déploie `dist/`.

## Open Graph

Pour un partage social, l’URL canonique est maintenant :

`/article/SLUG/`

Le bouton de partage peut continuer à utiliser :

`/functions/v1/og?slug=SLUG`

L’Edge Function fournit alors les balises OG aux plateformes qui suivent cette URL.

## Important

La génération statique est volontaire : les fragments `#/article/...` ne sont pas suffisamment exploitables par les crawlers. Les URLs publiques d’articles utilisent désormais `/article/slug/`.
