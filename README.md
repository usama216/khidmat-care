# Khidmat Care

Home physiotherapy in Lahore by verified physiotherapists. The product spec is in [khidmat-care-PRD.md](khidmat-care-PRD.md).

**Current stage: Phase 0 (validation).** The site is a static landing page. Bookings go through WhatsApp, and admin assigns physios by hand.

## Structure

```
apps/
  web/                    Next.js (App Router) + Tailwind CSS, static export
    src/app/(en)/         English page at /
    src/app/(ur)/ur/      Urdu page (RTL) at /ur/
    src/content/          All page text: en.ts, ur.ts (edit copy here)
    src/config/site.ts    WhatsApp number, phone, package prices
    src/components/       Landing sections and UI building blocks
```

The repo is a pnpm workspace, so the FastAPI backend (`apps/api`) can be added next to it for v1.

## Development

Requirements: Node 20+ and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:3000 and /ur/
pnpm build        # static site in apps/web/out
pnpm lint
pnpm typecheck
```

## Environment variables

Listed in [apps/web/.env.example](apps/web/.env.example). For local development, copy it to `apps/web/.env.local`.

| Variable | Test deployment | Real domain |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<project>.vercel.app` | `https://khidmat.care` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `923001234567` | same |
| `NEXT_PUBLIC_PHONE` | `+923001234567` | same |
| `NEXT_PUBLIC_ALLOW_INDEXING` | `false` (noindex, robots.txt blocks everything) | `true` |

`NEXT_PUBLIC_*` values are built into the public page, so **never put secrets in them**. Backend secrets (database, JWT, SMS, storage) will belong to the v1 API, not to this app.

Package prices are in [apps/web/src/config/site.ts](apps/web/src/config/site.ts) (`null` shows "Price on WhatsApp").

## Deploying to Vercel (test / partner review)

1. vercel.com → Add New → Project → import `usama216/khidmat-care`.
2. **Root Directory: `apps/web`** (Vercel detects Next.js and pnpm).
3. Add the four environment variables above, with `NEXT_PUBLIC_ALLOW_INDEXING=false`.
4. Deploy. If the final URL differs from the one you set, update `NEXT_PUBLIC_SITE_URL` and redeploy.

Security headers for Vercel are in [apps/web/vercel.json](apps/web/vercel.json).

## Moving to the real domain

- **Staying on Vercel:** add `khidmat.care` under Settings → Domains, set `NEXT_PUBLIC_SITE_URL=https://khidmat.care` and `NEXT_PUBLIC_ALLOW_INDEXING=true`, then redeploy. The Hobby plan is non-commercial only, so a live business needs Vercel Pro.
- **Cloudflare Pages (free, commercial use allowed):** connect the repo, build command `pnpm install && pnpm build`, output directory `apps/web/out`, `NODE_VERSION=22`, plus the same env variables. Headers come from [apps/web/public/_headers](apps/web/public/_headers).
