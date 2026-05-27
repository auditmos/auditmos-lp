# auditmos.com

The Auditmos landing page — Astro on Cloudflare Workers.

Static-first, SEO-friendly site replacing the previous auditmos.com. Built as a credibility/trust signal for prospects who arrive via referrals, LinkedIn, conferences, or partner introductions. Every URL also serves `text/markdown` at `<url>.md` (indexed via `/llms.txt`) so AI agents can ingest the entire site without scraping HTML.

- **PRD:** [`docs/prd-website-rebuild.md`](./docs/prd-website-rebuild.md) ([issue #1](https://github.com/auditmos/auditmos-lp/issues/1))
- **Plan:** [`plans/website-rebuild.md`](./plans/website-rebuild.md) — 7 phased tracer-bullet issues ([#2–#8](https://github.com/auditmos/auditmos-lp/issues))
- **Brand:** accent `#04d9ff`, logos vendored from [`auditmos/branding`](https://github.com/auditmos/branding)
- **Entity:** Auditmos OÜ · Reg 17025406 · VAT EE102758111 · Tallinn, Estonia

## Architecture

Every page is prerendered HTML served from Cloudflare's edge. **Exactly one** request-time route — `/api/contact` — runs on the Worker (Zod → Turnstile verify → Resend notify + confirm, atomic semantics).

- **Content:** Astro Content Collections + Zod for projects. Authoring = drop MD in `src/content/projects/`, commit, push.
- **MD-mirror:** every URL has a `.md` twin via `*.md.ts` endpoints; `/llms.txt` is the index. A single page-enumerator is the source of truth — adding a route extends both surfaces.
- **OSS page:** auto-aggregated from `github.com/auditmos` at build time with cached/empty fallback so GitHub outages never break a deploy.
- **Confidentiality:** project `client` field is either `{ name, url? }` (public) or `{ sector }` (anonymised NDA work). Same pipeline serves both.
- **Analytics:** Cloudflare Web Analytics only — no cookies, no consent banner.

See [`docs/prd-website-rebuild.md`](./docs/prd-website-rebuild.md) for the full specification.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Astro 6 (mostly `prerender = true`) |
| Adapter | `@astrojs/cloudflare` |
| Runtime | Cloudflare Workers (`nodejs_compat`) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Content | Astro Content Collections + Zod |
| Email | Resend (transactional) |
| Anti-spam | Cloudflare Turnstile |
| Analytics | Cloudflare Web Analytics |
| Language | TypeScript (strict, `@/*` → `src/*`) |
| Linter | Biome 2 |
| Testing | Vitest |
| Dead-code | knip |
| Release | semantic-release |
| Package manager | pnpm 10 |

## Quick start

```bash
pnpm install
pnpm cf-typegen
pnpm dev          # http://localhost:3000
```

## Authoring projects

```bash
pnpm new-project "Acme audit"   # scaffolds src/content/projects/acme-audit.md
```

Edit the frontmatter + body, commit, push to `main`. GitHub Actions deploys to staging automatically. Production cutover is a Cloudflare custom-domain swap.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Dev server on port 3000 |
| `pnpm build` | Production build to `./dist` |
| `pnpm preview` | Preview the production build locally |
| `pnpm deploy` | Build + `wrangler deploy` |
| `pnpm cf-typegen` | Regenerate `Env` types from `wrangler.jsonc` |
| `pnpm new-project "<title>"` | Scaffold a new project MD with frontmatter |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest |
| `pnpm types` | `astro check` + `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | Biome |
| `pnpm knip` | Unused files / deps / exports |
| `pnpm deps` / `pnpm deps:update` | Dependency updates via taze |
| `pnpm release` | semantic-release (CI only) |

## Project structure

```
src/
├── pages/                       # File-based routes (mostly prerender = true)
│   ├── index.astro              # Home
│   ├── software-development.astro
│   ├── r-and-d.astro
│   ├── security-audits.astro
│   ├── projects/                # /projects + /projects/[slug]
│   ├── open-source.astro
│   ├── about.astro
│   ├── contact.astro
│   ├── privacy.astro
│   ├── llms.txt.ts              # AI agent index
│   └── api/contact.ts           # Worker route (only non-prerendered route)
├── content/
│   └── projects/                # Markdown source for projects
├── layouts/Layout.astro         # Shared HTML shell + footer
├── components/                  # Reusable Astro components
├── assets/logos/                # Vendored from github.com/auditmos/branding
└── styles/globals.css           # Tailwind v4 entry + @theme tokens
```

Path alias `@/*` resolves to `src/*`.

## Cloudflare

Three Wrangler env blocks (`dev`, `staging`, `production`), each with its own Worker name. Deploy a specific env with `wrangler deploy --env <name>`.

### Secrets

Set per env via `wrangler secret put --env <name>`:

| Secret | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend transactional email |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile siteverify |
| `CONTACT_TO_EMAIL` | Form recipient inbox (`contact@auditmos.com` in production) |
| `GITHUB_TOKEN` *(optional)* | Raises OSS aggregator rate limit at build time |

Resend sends from `noreply@auditmos.com` — DKIM + SPF on auditmos.com DNS must be verified in Resend before launch.

### Bindings access

```ts
import { env } from "cloudflare:workers";

const apiKey = env.RESEND_API_KEY;  // typed via worker-configuration.d.ts
```

`Astro.locals.runtime` is removed in Astro v6 + `@astrojs/cloudflare` v13 — `import { env } from "cloudflare:workers"` is the only supported path. Run `pnpm cf-typegen` after editing `wrangler.jsonc` bindings.

DNS is on Cloudflare. Prefer `custom_domain: true` over routes with `zone_name` — see `.claude/rules/cloudflare-deployment.md`.

## Agent rules

- `CLAUDE.md` — project-level agent guide.
- `.claude/rules/` — topic rules that activate automatically based on the files being edited.
- `.claude/agents/` — `dd-w` (design-doc writer), `dd-i` (design-doc implementer), `mvp-e` (MVP enforcer).
- `/docs` — single source of truth for business requirements.
- `/plans` — phased implementation plans derived from docs.

## Learn More

- **[Astro](https://docs.astro.build/)** — content-first framework with islands architecture
- **[@astrojs/cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)** — Cloudflare Workers adapter
- **[Tailwind CSS v4](https://tailwindcss.com/docs/installation/using-vite)** — utility-first CSS, configured via CSS
- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)** — edge computing platform
- **[Resend](https://resend.com/docs)** — transactional email
- **[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)** — privacy-respecting anti-spam
- **[Biome](https://biomejs.dev/)** — fast formatter and linter

## License

Open source under the [ISC License](LICENSE).
