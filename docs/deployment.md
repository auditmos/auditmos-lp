# Deployment runbook

Manual, per-environment deploys from a local checkout — CI deliberately has no
deploy job. Requires an authenticated `wrangler` (`npx wrangler whoami`).

| Env        | Worker                    | Domain                 | Deploy                  |
| ---------- | ------------------------- | ---------------------- | ----------------------- |
| dev        | `auditmos-lp` / `-dev`    | (none, workers.dev)    | `pnpm deploy`           |
| staging    | `auditmos-lp-staging`     | `staging.auditmos.com` | `pnpm deploy:staging`   |
| production | `auditmos-lp-production`  | `auditmos.com`         | `pnpm deploy:production`|

`pnpm deploy:<env>` builds with that env's build-time vars baked in, then runs
`wrangler deploy --env <env>`. `pnpm secrets:<env>` pushes the runtime secrets
from `.dev.vars.<env>` via `wrangler secret bulk` (stdin — nothing hits disk).
Both fail fast when `.dev.vars.<env>` is incomplete.

## One-time prerequisites (dashboards)

1. **Turnstile** (Cloudflare dashboard → Turnstile): create a widget with
   hostnames `auditmos.com` **and** `staging.auditmos.com` → yields the site
   key (build-time, public) and secret key (runtime).
2. **Resend**: verify the `auditmos.com` sending domain (SPF + DKIM DNS
   records) and create an API key. Without a verified domain every form
   submission returns 502 — the endpoint requires both emails to send.
3. Optional — **Cloudflare Web Analytics**: create a site for auditmos.com and
   put the token in `.env` as `CLOUDFLARE_WEB_ANALYTICS_TOKEN` (build-time;
   analytics is silently off without it).

## Configure env files

```bash
cp .dev.vars.staging.example .dev.vars.staging        # then fill in
cp .dev.vars.production.example .dev.vars.production  # then fill in
```

## Staging

```bash
pnpm deploy:staging   # first deploy auto-creates staging.auditmos.com DNS + cert
pnpm secrets:staging  # after the Worker exists
```

Verify on https://staging.auditmos.com: pages render, `/sitemap.xml`,
`/llms.txt`, OG image at `/og.png`, and a real contact-form submission
(notification + confirmation email both arrive).

## Production cutover

`auditmos.com` is currently attached to the legacy `auditmos-web` Worker
(repo `auditmos/web`, last deployed 2026-02-23).

```bash
pnpm deploy:production
pnpm secrets:production   # immediately after — form 502s until secrets land
```

The first deploy prompts to move the `auditmos.com` custom domain off
`auditmos-web` — **confirming that prompt is the cutover** (near-instant,
static pages serve immediately). Post-cutover checks:

- Pages, `/sitemap.xml`, `/llms.txt`, `robots.txt` respond on auditmos.com.
- Contact form end-to-end (both emails arrive).
- OG card scrape (opengraph.xyz or LinkedIn Post Inspector) picks up `/og.png`.

## Decommission (after a few days of soak)

- Delete the `auditmos-web` Worker; archive the `auditmos/web` repo.
- Optional: `www.auditmos.com` has never had DNS — add a zone redirect rule
  (www → apex) in the dashboard if wanted.
