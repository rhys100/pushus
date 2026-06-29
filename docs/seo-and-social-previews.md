# SEO and social previews

PushUS ships per-route browser titles, static Open Graph tags, and branded share images for invite links.

## What works where

| Feature | Cloudflare Pages | Plain static host |
|---|---|---|
| Browser tab titles | Yes | Yes |
| Default OG image (`/og/default.png`) | Yes | Yes |
| `robots.txt` / `sitemap.xml` | Yes | Yes |
| Dynamic invite previews (`/join/:code`) | Yes (Pages Functions) | Generic static OG only |
| Dynamic invite share images (`/og/join/:code.png`) | Yes (Pages Functions) | Falls back to default image |

## Cloudflare Pages runtime env vars

Set these in **Cloudflare Pages → Settings → Environment variables** (Production and Preview):

| Variable | Example | Purpose |
|---|---|---|
| `SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` | Invite preview RPC |
| `SUPABASE_ANON_KEY` | `eyJ...` | Anon key for preview RPC |
| `APP_URL` | `https://www.pushus.app` | Canonical + OG absolute URLs |
| `APP_NAME` | `PushUS` | Optional branding in previews |

These mirror the frontend `VITE_*` values but are required at **runtime** for Pages Functions. Build-time `VITE_*` vars alone are not enough.

## Build-time assets

The default share image is generated during `npm run build`:

```bash
npm run og:generate
```

Outputs:

- `public/og/default.png` (1200×630)
- `public/og-image.png` (alias)

## Manual checks after deploy

1. Open `/og/default.png` — branded static card renders.
2. Open `/og/join/{valid-code}.png` — group name appears on the card.
3. Share `/join/{valid-code}` in Slack or iMessage — title and image preview look correct.
4. Crawler HTML check:

```bash
curl -A "facebookexternalhit/1.1" https://www.pushus.app/join/YOUR_CODE
```

Expect HTML with `og:title` and `og:image` pointing at the dynamic PNG URL.

## Self-hosting without Cloudflare Functions

You still get tab titles, static OG tags, and the default PNG. Invite links will not show group-specific previews unless you add equivalent edge/server middleware that:

1. Detects social crawlers on `/join/:code`
2. Calls `get_invite_group_preview` with the anon key
3. Returns OG HTML and/or a rendered PNG

See [self-hosting.md](./self-hosting.md).
