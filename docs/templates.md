# Auditmos project templates

**Owner:** Tomasz Kowalczyk · **Issued:** 2026-10-08 · **Scope:** starting any new Auditmos codebase, whether client delivery, an internal tool, an R&D prototype or open-source work.

Every new Auditmos project starts from one of six GitHub template repositories in the [auditmos](https://github.com/auditmos) organization. This document describes what each template contains, how to choose between them, and how to start. The templates are maintained and updated in their own repositories. This file only selects one; after that, the template's own README and `AGENTS.md` take over.

## 1. Read this before choosing

These instructions are for an agent, or a person, pointed at this file.

1. **Establish the facts that decide the choice.** Ask only for what the brief does not already say:
   - What runs: a browser UI, an HTTP API, both, a CLI or library, smart contracts?
   - Do users sign up and sign in to accounts? Do they connect a wallet?
   - Is it mostly content that visitors read, or an application whose screens change data?
   - Does a client require hosting outside Cloudflare, or a database other than Postgres?
2. **Apply the decision list in § 4.** The first rule that matches wins.
3. **Present one recommendation**, and one alternative when a second template is a reasonable fit. For each, give the reason in terms of the brief, and name what the template does **not** ship that the brief needs. § 5 lists the gaps all six share.
4. **The person decides.** Do not create a repository, rename anything or run setup before they confirm. `gh repo create` publishes a new repository in an organization.
5. **After generating**, follow the template's README start section and its `AGENTS.md`. From then on they govern the project, not this document.

Do not quote versions from this document. Read the template's `package.json` (`packageManager`, `engines` and the dependency ranges); the templates change every week.

## 2. Why Auditmos starts from templates

- **The same shape at every handover.** Agencies and client teams receive a repository whose layout, scripts and documentation match the previous one Auditmos delivered. All six answer `pnpm types`, `pnpm test` and `pnpm lint`, and check for dead code with `pnpm knip` (`pnpm unused` in ts-template).
- **Standards from the first commit.** Strict TypeScript, Biome, Vitest, dead-code detection, conventional commits with semantic-release, deep modules (a small interface over a large implementation) and typed errors are in place before the first feature. Nothing has to be retrofitted later.
- **Ready for coding agents.** Every template carries an `AGENTS.md`, with `CLAUDE.md` pointing at it.
  - The five Cloudflare templates add `.claude/rules/` organised by technology, plus design-doc agents.
  - ts-template ships Claude skills instead.
  - tstack-on-cf, astro-on-cf, hono-on-cf and saas-on-cf also test their own documentation: the build fails when a README or rule names a file that does not exist or contradicts the config. The instructions an agent follows stay true.
- **Production structure on day one.** The Cloudflare templates create separate dev, staging and production Workers, with observability on. They include CI that runs lint, types and tests, and an `init-project` script that renames the project and fans out the per-environment env files.
- **Maintained in one place.** Every Cloudflare template runs a Monday dependency-update workflow and a compatibility-date workflow. A fix or a lesson lands once, in the template, rather than separately in each project.
- **The limit.** A repository generated from a GitHub template keeps no link back to it. Later improvements to a template do not reach projects already started from it; port them deliberately when they matter.

## 3. Why the templates stay on Cloudflare

Five of the six templates deploy to Cloudflare Workers. Keeping them on one platform is deliberate.

- **One platform per project, and the same one for every project.** Compute, static assets, DNS, TLS certificates, custom domains, rate limiting, logs and secrets come from one account and one CLI, `wrangler`. A `custom_domain` route creates its own DNS record and certificate. The deployment runbook, debugging habits and incident lessons carry from one project to the next.
- **No servers to maintain.** There is no operating system, container image or runtime to patch. Each Worker pins a `compatibility_date`, and the templates move it forward through a reviewed pull request, so runtime changes do not arrive unannounced.
- **Environments and releases built in.** dev, staging and production are separate Workers from one config file. Worker versions allow a gradual rollout and an immediate rollback: hono-on-cf runs this as a canary in CI, and tstack-on-cf documents it in its release runbook.
- **Capabilities added as bindings, only when needed.** KV, R2, Queues, Durable Objects, Workflows, Workers AI and Hyperdrive are each one binding in `wrangler.jsonc`, typed by `wrangler types`. The templates ship few bindings on purpose, with commented examples of the likely next ones.
- **Data stays portable.** The templates that ship a database use Neon Postgres through Drizzle, which is standard Postgres reachable from anywhere. Moving compute later does not mean migrating data.
- **Known limits.**
  - Workers is not Node.js. `nodejs_compat` covers most packages, not all.
  - Requests have CPU and duration limits, so long or heavy work belongs in Queues or Workflows, or outside Workers entirely. Check the current limits for the account's plan rather than relying on remembered numbers.
  - Work that does not fit Workers (CLIs, libraries, local scripts) starts from ts-template, which deliberately has no Cloudflare dependency.

## 4. Choosing a template

**First, check the constraints.** No template fits as-is in either of these cases. Say so in the recommendation and agree the approach before choosing anything:
- **A client requires hosting outside Cloudflare for a web app or API.** The five web templates are built around Workers. ts-template has no web framework, so it is not the answer for a website either.
- **A database other than Postgres is required.** Every template that ships a database assumes Neon Postgres through Drizzle. Another engine means replacing that layer; name the cost.

Then go down the list and stop at the first match. In this list, a *UI* means a web interface built in this repository. A native mobile app is a client of the API, not a UI here.

| # | If the project… | Start from |
|---|---|---|
| 1 | is not a web app or HTTP API: a CLI, a library, a script, or a background process that runs outside Workers | [ts-template](#ts-template) |
| 2 | involves smart contracts or wallet connection | [tstack-on-cf-onchain](#tstack-on-cf-onchain) |
| 3 | is mostly content (a marketing site, documentation, a blog, case studies, a landing page) with a handful of endpoints at most | [astro-on-cf](#astro-on-cf) |
| 4 | is an HTTP API with no UI of its own: a backend for a mobile app, an integration, a service other systems call | [hono-on-cf](#hono-on-cf) |
| 5 | is a product whose users sign up and sign in through a UI | [saas-on-cf](#saas-on-cf) |
| 6 | is a full-stack React application without accounts of its own: an internal tool (behind Cloudflare Access or auth you add), a dashboard, a prototype, a demo | [tstack-on-cf](#tstack-on-cf) |

When two rows seem to fit:

- **astro-on-cf or tstack-on-cf.** *Content* means pages written by the team and read by visitors. Screens that query live data, such as dashboards, data browsers and admin views, are application screens even when they are read-only. If most pages are content, choose astro-on-cf: it ships no client JavaScript by default and adds React islands where needed. If most screens show or change data, choose tstack-on-cf. auditmos.com itself was generated from astro-on-cf.
- **hono-on-cf or saas-on-cf.** If a web UI for end users is planned in this codebase, even for later, start from saas-on-cf: its data-service is the same kind of Hono API, with the frontend and the service binding already wired. Choose hono-on-cf when the API is the product.
- **tstack-on-cf or saas-on-cf.** Sign-in is the line. saas-on-cf ships Better Auth, an approval gate and default-closed server functions. tstack-on-cf ships no authentication, and its demo API is public ("It must not ship as-is"). If accounts are in scope, start from saas-on-cf rather than adding them later.
- **Two needs at once**, such as a content site plus an API, or a dApp plus a separate API: prefer two repositories from two templates. A small API inside a content site can stay in astro-on-cf. Its own rules say to mount Hono there only for shared middleware, roughly ten or more endpoints, or typed RPC.

## 5. Comparison

| Template | Shape | UI | API | Sign-in | Database | Cloudflare beyond Workers | Deploys |
|---|---|---|---|---|---|---|---|
| tstack-on-cf | One Worker | React: TanStack Start, shadcn/ui | Hono, same Worker | None; seam in `src/hono/factory.ts` | Neon + Drizzle | None | Manual, release runbook |
| astro-on-cf | One Worker | Astro + Tailwind; no React unless added | Astro endpoints | None | Optional Neon + Drizzle (`--with-db`) | None | Manual |
| hono-on-cf | Monorepo: API Worker + `data-ops` package | None | Hono REST | Better Auth email + password, bearer tokens, approval gate | Neon + Drizzle | Rate Limiting | CI: canary, then promote or roll back |
| saas-on-cf | Monorepo: frontend Worker + API Worker + `data-ops` | React: TanStack Start, shadcn/ui | Hono, over a service binding | Better Auth email + password, approval gate | Neon + Drizzle | Service binding, Rate Limiting | Manual, per app |
| tstack-on-cf-onchain | One Worker + Foundry project | React + wagmi, viem, ConnectKit | Hono, same Worker | Wallet connection only | Optional Neon + Drizzle | Rate Limiting | Manual; production migrates first |
| ts-template | npm package: library + CLI | None | None | None | None | Not on Cloudflare | GitHub Releases only |

**None of the six ships:**
- billing or payments
- organizations or multi-tenancy
- transactional email
- internationalization
- an admin interface (in hono-on-cf and saas-on-cf, an account is approved with a SQL update)

Plan these explicitly when a brief needs them.

## 6. The templates

### tstack-on-cf

[github.com/auditmos/tstack-on-cf](https://github.com/auditmos/tstack-on-cf) · [Use this template](https://github.com/new?template_name=tstack-on-cf&template_owner=auditmos)

Full-stack React on one Worker: TanStack Start (SSR, file-based routing, Query), a Hono API layer, Neon Postgres through Drizzle, Zod and shadcn/ui.

- **Ships:**
  - A `clients` CRUD demo, both API and UI
  - Health endpoints at `/api/health/live` and `/api/health/ready`
  - `AppError` and `Result` error handling
  - Per-environment Drizzle migrations and seeds
  - A release runbook and decision records in `docs/decisions/`
- **Does not ship:** authentication or rate limiting. The demo API is public, and the README says it must not ship as-is. Authentication plugs in at `src/hono/factory.ts`.
- **Start:**
  1. `pnpm install`
  2. `pnpm run init-project`
  3. Fill in the Neon `DATABASE_*` values.
  4. `pnpm cf-typegen && pnpm db:migrate:dev && pnpm dev`
  5. Remove the demo using the README's "Remove these on project start" list.
- **Deploys:** manual, with `pnpm run deploy`, `pnpm deploy:staging` and `pnpm deploy:production`, following `docs/release-runbook.md` (migrate, build, deploy, verify). Continuous deployment was considered and rejected for this template.

### astro-on-cf

[github.com/auditmos/astro-on-cf](https://github.com/auditmos/astro-on-cf) · [Use this template](https://github.com/new?template_name=astro-on-cf&template_owner=auditmos)

Content-first sites and SSR apps: Astro on one Worker, Tailwind, native Astro endpoints and no UI framework by default.

- **Ships:**
  - A landing page and `/api/health`
  - An SEO module with a sitemap and robots.txt
  - Security-header middleware
  - A generated `/llms.txt`
  - An optional Drizzle and Neon data layer, added by `init-project --with-db`
- **Does not ship:** authentication, content collections (its rules describe how to add them), or React. Add React as an island with `pnpm astro add react`.
- **Start:**
  1. `pnpm install`
  2. `pnpm run init-project`, adding `--with-db` for the database
  3. `pnpm cf-typegen && pnpm dev`
- **Deploys:** manual by design, with `pnpm deploy:dev`, `deploy:staging` or `deploy:production`. `SITE_URL` must be set at build time. CI checks every change but never deploys.
- **In use:** auditmos.com was generated from it.

### hono-on-cf

[github.com/auditmos/hono-on-cf](https://github.com/auditmos/hono-on-cf) · [Use this template](https://github.com/new?template_name=hono-on-cf&template_owner=auditmos)

A REST API monorepo on Workers: a Hono `data-service` Worker and a shared `data-ops` package (Drizzle, Neon, Better Auth, Zod). It has no frontend.

- **Ships:**
  - Better Auth email and password sign-in with bearer tokens
  - `requireAuth()`: 401 without a session, 403 until the account is approved
  - Request IDs, CORS and an error handler
  - Rate Limiting bindings
  - Health endpoints `/health/live` and `/health/ready`
  - An example `/clients` domain, a seed script and `sync-secrets.sh`
- **Does not ship:** a UI, an OpenAPI document, or wired queues, Durable Objects or Workflows. `wrangler.jsonc` only carries commented KV and Queues examples.
- **Start:**
  1. `pnpm install`
  2. `pnpm run init-project`. It prompts for a project name and a custom domain, and binds `api-staging.<domain>` and `api.<domain>`.
  3. Fill in the Neon values, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
  4. `pnpm run setup && pnpm run db:generate:dev && pnpm run db:migrate:dev`
  5. `pnpm run dev:data-service`
- **Approve an account:** `UPDATE auth_user SET approved = true WHERE email = '…';`
- **Deploys:** from CI only.
  - A push to `main` deploys to staging; a `v*.*.*` tag deploys to production.
  - Each deploy uploads a version, sends 10% of traffic to it and checks `/health/ready`. It then promotes the version to 100% or rolls back.
  - One-time setup: the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, GitHub environments `staging` and `production`, and a custom domain. Until these exist, the deploy job skips.

### saas-on-cf

[github.com/auditmos/saas-on-cf](https://github.com/auditmos/saas-on-cf) · [Use this template](https://github.com/new?template_name=saas-on-cf&template_owner=auditmos)

A multi-app SaaS monorepo: a TanStack Start `user-application` Worker and a Hono `data-service` Worker, connected by a service binding and sharing a `data-ops` package.

- **Ships:**
  - Better Auth email and password sign-in. New accounts wait on a pending-approval screen.
  - Every server function requires an approved session unless it is listed in `PUBLIC_SERVER_FNS`.
  - Three data-access demos:
    - server function → `data-ops`
    - server function → service binding → data-service
    - browser → public data-service
  - Rate limiting on both Workers, and `sync-secrets.sh` per app
- **Does not ship:** the gaps in § 5. Approve accounts with the same SQL update as hono-on-cf.
- **Start:**
  1. `fnm use`. Node is pinned in `.node-version`.
  2. `pnpm install`
  3. `pnpm run init-project`, or non-interactively with `--name`, `--domain`, `--staging-prefix` and `--non-interactive`.
  4. Fill in the Neon values and `BETTER_AUTH_SECRET`, plus a `DATA_SERVICE_API_TOKEN` matching the data-service's `API_TOKEN`.
  5. `pnpm run setup && pnpm run db:generate:dev && pnpm run db:migrate:dev`
  6. Start `pnpm run dev:data-service` and `pnpm run dev:user-application` in two terminals.
- **Deploys:** manual, per app, with `pnpm run deploy:<staging|production>:<app>`. Secrets are pushed with `bash apps/<app>/sync-secrets.sh <env>`.

### tstack-on-cf-onchain

[github.com/auditmos/tstack-on-cf-onchain](https://github.com/auditmos/tstack-on-cf-onchain) · [Use this template](https://github.com/new?template_name=tstack-on-cf-onchain&template_owner=auditmos)

Full-stack dApps: a TanStack Start frontend and a Hono API on one Worker, with Foundry contracts, wagmi, viem and ConnectKit. A typegen step turns Foundry artifacts into typed ABIs and contract addresses.

- **Ships:**
  - A `Counter.sol` example wired through to a UI button, plus a deployment registry
  - A chain registry (mainnet, Sepolia, Anvil) with RPC failover
  - `pnpm contracts:dev`, which starts Anvil, deploys and regenerates types
  - A Rate Limiting binding, CORS and request IDs
  - An optional database: without database secrets, the app runs chain-only and the database-backed routes answer 503
- **Does not ship:** server-side sign-in. Authentication is an extension point in the API middleware chain.
- **Prerequisites:** Foundry (`anvil`, `forge`) on the PATH, and a WalletConnect project ID. This template pins an older pnpm major in `packageManager` than the others; the pnpm launcher switches versions automatically.
- **Start:**
  1. `pnpm install`
  2. `pnpm run init-project`
  3. Set `VITE_CHAIN_ID` and `VITE_WALLETCONNECT_PROJECT_ID`.
  4. `pnpm contracts:dev`
  5. Optionally, set up Neon.
- **Deploys:** manual, with `pnpm deploy:staging` and `pnpm deploy:production`; production runs its database migrations first. Contracts deploy separately through `pnpm contracts:deploy:testnet` and `contracts:deploy:mainnet` with a deployer key.
- **Lineage:** generated from tstack-on-cf in April 2026, and the two have diverged since. A fix in one is not automatically in the other.

### ts-template

[github.com/auditmos/ts-template](https://github.com/auditmos/ts-template) · [Use this template](https://github.com/new?template_name=ts-template&template_owner=auditmos)

TypeScript for work that does not run on Workers: CLI tools, libraries and scripts.

- **Ships:**
  - An ESM-only package with a library entry and a CLI binary
  - Strict types, Biome, Vitest and tsdown
  - Environment validation with `@t3-oss/env-core` and Zod
  - `Result<T, E>` for recoverable errors
  - Deep-module rules in `AGENTS.md`
- **Does not ship:** Cloudflare, a web framework, a database, or npm publishing. The package is `private: true`, and the README explains how to publish it.
- **Start:**
  1. `pnpm install`
  2. `pnpm rename <project-name>`
  3. Replace the demo `greet` module, then rewrite the README and `AGENTS.md`.

  The first commit must be conventional, for example `chore: initial commit`.
- **Releases:** there is no deploy. semantic-release creates GitHub Releases from CI, and the first `feat:` commit on `main` cuts v1.0.0.

## 7. Starting a project

Once the choice is confirmed, generate the repository under the organization that will own it (`auditmos`, or the client's own):

```bash
gh repo create <owner>/<project-name> --template auditmos/<template> --private --clone
cd <project-name>
pnpm install
pnpm run init-project        # ts-template: pnpm rename <project-name>
```

The "Use this template" links in § 6 do the same from the browser. Choose visibility deliberately: client work stays private unless the engagement says otherwise.

Then:

- Follow the template's README start section to the end: env files, Neon, secrets.
- Delete the template's demo code once the first real feature exists:
  - the `clients` domain in tstack-on-cf, hono-on-cf, saas-on-cf and tstack-on-cf-onchain
  - also `Counter.sol` and its wiring in tstack-on-cf-onchain
  - the `greet` module in ts-template

  Each README says where its demo code lives.
- Replace the template's wording in the README and `AGENTS.md` with the project's own.
- Run `pnpm types`, `pnpm test`, `pnpm lint` and `pnpm knip` (`pnpm unused` in ts-template) before the first feature commit.
- For Auditmos-branded pages, reports and tools, the [design manual](https://auditmos.com/design.md) governs appearance. Client-owned work follows the engagement's branding.

## 8. Maintaining this document

The templates were inspected on 2026-10-08 at these commits:

| Template | Commit |
|---|---|
| tstack-on-cf | `aa08003` |
| astro-on-cf | `583adce` |
| hono-on-cf | `66acb92` |
| saas-on-cf | `a051382` |
| tstack-on-cf-onchain | `0c3d878` |
| ts-template | `18ba579` |

- When a template changes what it ships, how it starts or how it deploys, update § 4–6 here. The template's own README and `AGENTS.md` remain the authority on detail.
- A new template needs an entry in § 4's decision list, the § 5 matrix and § 6. It also needs one in `src/oss/repositories.ts`, the website's open-source inventory.
- This document is published verbatim at `/templates.md`, served from `docs/templates.md` in the auditmos-lp repository and listed in `/llms.txt`. Edit that source document; no second editable copy is maintained.
