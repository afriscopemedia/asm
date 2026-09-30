# AfriScope Media — déploiement Supabase

1. Exécuter `setup.sql` dans Supabase SQL Editor.
2. Déployer les quatre Edge Functions : `ai-editor`, `track-visit`, `og`, `daily-newsletter`.
3. Configurer les secrets Edge Functions :
   - `OPENAI_API_KEY` — clé API OpenAI pour la génération d'articles.
   - `OPENAI_MODEL` — optionnel, par défaut `gpt-5.6-luna`.
   - `SUPABASE_SERVICE_ROLE_KEY` — secret Supabase utilisé uniquement côté Edge Functions.
   - `PUBLIC_SITE_URL` — URL publique exacte du site GitHub Pages, sans `/#/...`.
   - `RESEND_API_KEY` — clé Resend pour les newsletters.
   - `NEWSLETTER_FROM` — expéditeur vérifié, par exemple `AfriScope Media <newsletter@votre-domaine.com>`.
   - `NEWSLETTER_CRON_SECRET` — secret aléatoire facultatif pour protéger l'endpoint de newsletter.
4. Programmer `daily-newsletter` à 05:00 UTC, soit 06:00 à Libreville. Exemple dans `setup.sql`.
5. Dans Supabase Storage, le bucket `article-images` est créé par le SQL et rendu publiquement lisible. Les uploads nécessitent une session authentifiée.
6. Pour Open Graph, le partage d'un article utilise l'Edge Function `/functions/v1/og?slug=...`. Les robots sociaux reçoivent ainsi un HTML contenant les métadonnées de l'article, malgré le routage en hash de GitHub Pages.

## Déploiement CLI

Depuis le dossier contenant `supabase/` :

```bash
supabase login
supabase link --project-ref xzgxabefcyxenxlymfur
supabase functions deploy ai-editor
supabase functions deploy track-visit --no-verify-jwt
supabase functions deploy og --no-verify-jwt
supabase functions deploy daily-newsletter --no-verify-jwt
```

Puis renseigner les secrets dans Supabase Dashboard → Edge Functions → Secrets.
