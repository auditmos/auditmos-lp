# Astro on Cloudflare

*AI agent index: [llms.txt](./llms.txt)*

A production-ready **template** for building content-first sites and SSR apps on Cloudflare Workers with Astro. Ships with Tailwind CSS v4, native Astro API endpoints, a strict Biome + Vitest toolchain, an optional Drizzle + Neon data layer, and the full Auditmos baseline (simple-git-hooks, knip, taze, semantic-release, `.claude/` rules).

Use it as the starting point for your next project — clone it, rename it, decide whether you want the data layer, and start shipping.

## Using this Template

1. Click **Use this template** on GitHub (or `gh repo create --template`).
2. `pnpm install`.
3. `pnpm run init-project` — prompts for a kebab-case project name, renames `wrangler.jsonc` + `package.json`, and fans out `.env.example` → `.env` and `.{dev,staging,production}.vars.example` → `.dev.vars` / `.staging.vars` / `.production.vars`. Pass `--with-db` to add the Drizzle/Neon data layer scaffolding. Idempotent — re-runnable, never overwrites filled-in files.
4. *(Only if `--with-db`)* Provision a Neon database and fill `DATABASE_HOST/USERNAME/PASSWORD` in `.dev.vars` (and the staging/production variants when you deploy them).
5. Run `pnpm cf-typegen && pnpm dev`.

See [Quick Start](#quick-start) below for the dev-loop commands.

## Why this template

- **Edge-first** — Astro `output: "server"` running on Cloudflare Workers via `@astrojs/cloudflare`. Bindings typed automatically through `worker-configuration.d.ts`.
- **No framework lock-in** — pure Astro by default. Add React/Vue/Svelte islands per project with `pnpm astro add <integration>` only when you actually need them.
- **Type-safe end-to-end** — `astro check` + strict TypeScript, Zod at every endpoint boundary, typed Cloudflare `Env`.
- **Three-env wrangler** — `dev`, `staging`, `production` blocks shipped out of the box. Deploy with `wrangler deploy --env <name>`.
- **Agent-friendly** — project rules in `.claude/rules/` activate automatically based on the files you touch. Mirrors the conventions of every other Auditmos template repo (`saas-on-cf`, `tstack-on-cf`, `hono-on-cf`).

## Quick Start

```bash
# Install dependencies
pnpm install

# Generate Cloudflare Env types
pnpm cf-typegen

# Start the dev server
pnpm dev
```

The app runs on http://localhost:3000.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Dev server on port 3000 (Astro + Vite) |
| `pnpm build` | Production build to `./dist` |
| `pnpm preview` | Preview the production build locally |
| `pnpm deploy` | Build and deploy to Cloudflare Workers |
| `pnpm cf-typegen` | Generate `Env` types from `wrangler.jsonc` |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest |
| `pnpm types` | `astro check` + `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | Biome check / auto-fix |
| `pnpm knip` | Detect unused files, deps, and exports |
| `pnpm deps` / `pnpm deps:update` | Check / apply dependency updates via taze |
| `pnpm release` | semantic-release (CI only) |

If you opted into the data layer with `--with-db`, you also get `db:generate:{dev,staging,production}`, `db:migrate:*`, `db:pull:*`, `db:studio`, and `db:seed:*` — all wired through `@dotenvx/dotenvx`.

## Project Structure

```
src/
├── pages/                       # File-based routes
│   ├── index.astro              # Landing page
│   └── api/                     # API endpoints (./api/<name>.ts)
├── layouts/
│   └── Layout.astro             # Shared HTML shell
├── components/                  # Reusable Astro components
├── styles/
│   └── globals.css              # Tailwind v4 entry
└── env.d.ts                     # App.Locals typed against CF Env
```

Path alias `@/*` resolves to `src/*`.

## Cloudflare Integration

### `wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "astro-on-cf",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "compatibility_date": "2025-09-02",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": "./dist", "binding": "ASSETS" },
  "observability": { "enabled": true },
  "env": {
    "dev":        { "name": "astro-on-cf-dev" },
    "staging":    { "name": "astro-on-cf-staging" },
    "production": { "name": "astro-on-cf-production" }
  }
}
```

- Use `wrangler.jsonc` (not `.toml`).
- Prefer `custom_domain: true` over routes with `zone_name` — see `.claude/rules/cloudflare-deployment.md`.
- Run `pnpm cf-typegen` whenever you add bindings to regenerate `worker-configuration.d.ts`.

### Accessing bindings

```ts
// src/pages/api/hello.ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = () => Response.json({ env: env.CLOUDFLARE_ENV });
```

In Astro v6 + `@astrojs/cloudflare` v13 the `Astro.locals.runtime` proxy is gone — `import { env } from "cloudflare:workers"` is the only supported path for bindings and vars.

### Secrets & environments

Per-environment vars live in `.dev.vars` / `.staging.vars` / `.production.vars`, never committed. For staging/production, mirror the same keys as Cloudflare secrets via `wrangler secret put --env <name>`.

## Optional: Drizzle + Neon data layer

Re-run `pnpm run init-project --with-db` (or pass the flag the first time) to scaffold:

- `drizzle-{dev,staging,production}.config.ts`
- `src/db/{client,health,schema.ts,setup.ts}`
- `db:*` scripts wired through `@dotenvx/dotenvx`
- `DATABASE_HOST/USERNAME/PASSWORD` keys in every `.{env}.vars.example`

Same conventions as `tstack-on-cf` and `hono-on-cf`: domain-per-folder, narrow public API, per-env migration directories.

## Agent Rules & Design Docs

This template is set up for agent-assisted development:

- `CLAUDE.md` → symlink to `AGENTS.md` — project-wide agent guide.
- `.claude/rules/` — topic rules (`general.md`, `deep-modules.md`, `error-handling.md`, `atomic-imports.md`, `cloudflare-deployment.md`, plus `frontend/{astro,tailwind-v4}.md` and `api/{cloudflare-workers,astro-endpoints}.md`) that activate automatically based on the files being edited.
- `.claude/agents/` — `dd-w` (design-doc writer), `dd-i` (design-doc implementer), `mvp-e` (MVP enforcer).
- `/docs` — single source of truth for business requirements / design docs.

## Learn More

- **[Astro](https://docs.astro.build/)** — content-first framework with islands architecture
- **[@astrojs/cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)** — Cloudflare Workers adapter
- **[Tailwind CSS v4](https://tailwindcss.com/docs/installation/using-vite)** — utility-first CSS, configured via CSS
- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)** — edge computing platform
- **[Biome](https://biomejs.dev/)** — fast formatter and linter
- **[Drizzle ORM](https://orm.drizzle.team/)** *(when `--with-db`)* — type-safe SQL
- **[Neon](https://neon.tech/)** *(when `--with-db`)* — serverless Postgres

## License

Open source under the [ISC License](LICENSE).
