# PushUS self-hosting

PushUS Community is designed to run on **your own Supabase project** with billing disabled.

## Quick start

1. Fork or clone this repository.
2. Create a Supabase project at [supabase.com](https://supabase.com) or run Supabase locally.
3. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Keep `VITE_BILLING_ENABLED=false` for Community/self-hosted installs.
5. Apply migrations (when available): `supabase db reset`
6. Build and deploy the static SPA: `npm run build` → serve `dist/`

## Billing

**Slice 1A (Community):** No Stripe required. All groups use `billing_status = exempt`. Write access is controlled by RLS and the `can_group_write()` stub.

**Slice 1B+:** Optional Cloud-style billing for forks that configure Stripe. See [billing.md](billing.md).

Self-hosters do **not** need Stripe keys unless they explicitly enable billing.

## Auth

Configure Supabase Auth providers in your project dashboard:

- Email magic link (recommended minimum)
- Google OAuth (optional; documented as skippable for magic-link-only forks)

Set redirect URLs for localhost and your production domain.

## Database

- Run migrations from `supabase/migrations/`
- Optional demo data: `supabase/seed.sql`
- Never expose the **service role key** in the frontend or commit it to git

## Deployment

PushUS is a static SPA. Deploy `dist/` to any static host (Cloudflare Pages, Vercel, GitHub Pages, nginx, etc.).

Set environment variables at build time for `VITE_*` values.

## Fork transparency

Set in your build environment:

- `VITE_SOURCE_REPO_URL` — link to your fork or upstream repo
- `VITE_DEPLOYMENT_NAME` — name shown in About (e.g. "My Gym PushUS")
- `VITE_IS_MODIFIED_FORK=true` if you have modified the codebase

## Support

You are responsible for your own hosting, backups, auth configuration, and database maintenance when self-hosting.
