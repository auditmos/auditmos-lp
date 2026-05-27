# Plan: auditmos.com rebuild

> Source PRD: `docs/prd-website-rebuild.md`

## Architectural decisions

Durable decisions that apply across all phases. These should not change as later phases are built; if a phase needs to revisit one, raise it before proceeding.

- **Architecture style**: Static-first Astro 6 with `prerender = true` on every page. Exactly one request-time route (`/api/contact`) runs on the Cloudflare Worker. All other content is served from edge cache as HTML.
- **Hosting**: Cloudflare Workers via `@astrojs/cloudflare` adapter. Three Wrangler env blocks (`dev`, `staging`, `production`) with one Worker name each. DNS already on Cloudflare; production cutover = custom-domain swap.
- **Content storage**: Markdown files in the repo, no database. Projects live in an Astro Content Collection with a Zod schema. Authoring is a pure git workflow — drop MD, commit, push, deploy.
- **Confidentiality model**: Each project declares its `client` as either `{ name, url? }` (public) or `{ sector }` (anonymised). Exactly one variant is required. Same pipeline serves both.
- **Dual-format publishing**: Every URL has a `.md` twin and is listed in `/llms.txt`. A single page-enumerator is the source of truth — adding a route automatically adds it to both surfaces.
- **Anti-spam + email**: Cloudflare Turnstile (anti-spam, no cookies) + Resend (transactional). Sender `noreply@auditmos.com` requires DKIM + SPF on auditmos.com DNS. Recipient `contact@auditmos.com`. Two emails per submission (notification + confirmation), atomic — no partial sends observable.
- **Analytics**: Cloudflare Web Analytics only. No cookies, no consent banner, no third-party JS.
- **Brand**: Accent colour `#04d9ff`. Logo SVGs vendored from `github.com/auditmos/branding` into the repo. Tailwind v4 with `@theme` block — no `tailwind.config.js`.
- **Localisation**: English only in v1. Schema-level support for `lang` is not in scope.
- **CI/CD**: GitHub Actions on `auditmos/auditmos-lp`. PRs run `pnpm types && pnpm lint && pnpm knip && pnpm test`. Push to `main` deploys via `wrangler deploy`. Secrets sourced from GitHub Actions and projected into Wrangler env at deploy time.
- **Performance budget**: Per-page Lighthouse Performance ≥ 95, Accessibility ≥ 95, SEO = 100, Best Practices ≥ 95. Page weight ≤ 50 KB per prerendered page (Turnstile on `/contact` excepted).
- **SEO surface**: Per-page meta + OG + JSON-LD (`Organization` site-wide, `Service` per service page). Sitemap via `@astrojs/sitemap`. `robots.txt` allows all, declares sitemap + `/llms.txt`.
- **Legal entity (footer, every page)**: Auditmos OÜ · Registration 17025406 · VAT EE102758111 · Narva mnt 13-27, 10151 Tallinn, Estonia.

---

## Phase 1: Deployable brand skeleton

**User stories**: U12, U13, U14, U17, U18, U19, U20, U27, U34, U35, U37

### What to build

A minimum site — a single home route with the brand wired up — deployed end-to-end to `staging.auditmos.com` via GitHub Actions. The home page shows the Auditmos logo and accent colour, with a placeholder hero ("Auditmos: Security, Software Development & R&D"), a navigation skeleton (no real targets yet), and the legal footer with the real OÜ entity data. The MD-mirror, projects, contact form, and OSS aggregator are not in this phase — they are later slices into this same skeleton.

This phase exists to validate the highest-risk *integrations* (Wrangler envs, GitHub Actions, Cloudflare custom domain, brand asset pipeline, analytics) before any content effort is invested. By the end, pushing to `main` deploys.

### Acceptance criteria

- [ ] Brand assets vendored from `github.com/auditmos/branding` into the repo (logo lockups + icon, SVG); accent colour `#04d9ff` set as a Tailwind v4 theme token; system-stack font wired.
- [ ] A shared `Layout` component is in place with `<head>` meta defaults, the footer with full Auditmos OÜ legal data, and a navigation skeleton.
- [ ] Home route renders the brand and a placeholder hero with no JavaScript shipped to the browser.
- [ ] Three Wrangler env blocks (`dev`, `staging`, `production`) configured; each maps to its own Worker name; staging uses `staging.auditmos.com` as a custom domain (preferred over zone-name routes).
- [ ] Wrangler secrets for staging are placeholders for now (`RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CONTACT_TO_EMAIL`); the build does not depend on their values.
- [ ] GitHub Actions workflow: on PR runs `pnpm types && pnpm lint && pnpm knip && pnpm test`; on push to `main` runs the same plus `wrangler deploy --env staging`. Required-status-check enforced on `main`.
- [ ] Cloudflare Web Analytics token is injected into the layout from build env; reporting visible in the CF dashboard within an hour of staging traffic.
- [ ] Lighthouse on staging home: Performance ≥ 95, Accessibility ≥ 95, SEO = 100, Best Practices ≥ 95.
- [ ] Visiting `https://staging.auditmos.com/` shows the brand and footer; the page renders identically with JavaScript disabled.

---

## Phase 2: Static content pages

**User stories**: U1, U2, U3, U4, U5, U6, U7, U8, U17, U26, U27

### What to build

All content pages that are not project-driven, with finalised copy: home (real value-prop + service teasers + placeholder "featured projects" slot), three separate service pages (`/software-development`, `/r-and-d`, `/security-audits`), `/about` (company-only — mission, values, entity, no bios), and `/privacy` (GDPR baseline copy: data collected, processors Resend + Cloudflare, retention, user rights, contact email). Navigation links activate. Per-page meta and JSON-LD are real, sitemap and `robots.txt` are in place.

Each service page is its own URL (not anchors on a single page) — the reason is SEO long-tail capture for each service category. JSON-LD includes the site-wide `Organization` plus a `Service` block per service page.

### Acceptance criteria

- [ ] Six pages live on staging: `/`, `/software-development`, `/r-and-d`, `/security-audits`, `/about`, `/privacy`. Navigation links all working.
- [ ] Each service page has unique `<title>`, meta description, OG tags, and a `Service` JSON-LD block describing that offering.
- [ ] Site-wide `Organization` JSON-LD includes legal name, VAT, address, and `contactPoint` for `contact@auditmos.com`.
- [ ] `@astrojs/sitemap` generates `/sitemap.xml` listing all routes.
- [ ] `public/robots.txt` allows all crawlers, references `/sitemap.xml`, and (forward-looking) references `/llms.txt` even though it lands in phase 4.
- [ ] `/privacy` page describes: what data the contact form collects, processors (Resend, Cloudflare Turnstile), Cloudflare Web Analytics (no cookies, no PII), retention, user rights (access/erasure), and the data-request contact email.
- [ ] Every prerendered page is ≤ 50 KB transferred (HTML + CSS, no JS).
- [ ] OG meta validates in a social-share preview tool for at least the home page.
- [ ] Manual smoke test on a low-end mobile profile: First Contentful Paint < 1.5 s on a 3G throttle.

---

## Phase 3: Projects collection + listing + detail

**User stories**: U2, U5, U8, U28, U29, U30, U31, U36

### What to build

A working projects pipeline end-to-end: a Zod-typed Astro Content Collection for `projects`, the `/projects` index page with project cards, the `/projects/[slug]` detail page rendered from MD, and the "Featured projects" block on the home page now reads from the same collection. A `pnpm new-project "<title>"` scaffolder writes a new MD file with frontmatter prefilled so the marginal cost of adding a project is near-zero. Two sample projects ship: one named (e.g. an OSS or R&D project) and one anonymised (e.g. `client: { sector: "Banking" }`) so both confidentiality variants are demonstrably working.

This phase lands the **content schema validation criterion** from the PRD.

### Acceptance criteria

- [ ] Astro Content Collection with Zod schema for projects, validating: `title`, `slug`, `summary`, exactly one of `client.name` or `client.sector`, optional `industry`, `year`, `stack[]`, `hero`, `links[]`.
- [ ] A project MD missing a required field or providing both `client.name` and `client.sector` fails `astro build` with a clear field-level error pointing to the offending file.
- [ ] Two sample projects exist in the repo: one named-client variant, one anonymised-sector variant. Both render correctly on `/projects/<slug>`.
- [ ] `/projects` index shows project cards (title, summary, client display string, year, stack tags) with deterministic ordering (configurable in frontmatter — default newest-year first).
- [ ] `/projects/[slug]` detail page renders the project's MD body, frontmatter metadata (client display string, industry, year, stack, optional links to live/source), and a "Contact us about this" CTA linking to `/contact`.
- [ ] Home page "Featured projects" block reads the same collection; a frontmatter flag controls whether a project is featured.
- [ ] `pnpm new-project "<title>"` script scaffolds `src/content/projects/<slug>.md` with frontmatter prefilled (title, today's year, empty stack array, anonymised-sector placeholder) and prints the file path.
- [ ] Vitest covers: schema accepts named variant, schema accepts anonymised variant, schema rejects both-present, schema rejects missing required fields.
- [ ] Adding a new project MD, committing, and pushing to `main` results in the new project visible on staging within one CI run; no manual step required.

---

## Phase 4: MD-mirror + `/llms.txt`

**User stories**: U15, U16, U32

### What to build

Every URL on the site (excluding `/api/*`) becomes available as a `.md` URL returning `text/markdown`. `/llms.txt` becomes the index that lists every such URL with its title and one-line description. A single page-enumerator helper is the source of truth for both the mirror endpoints and `/llms.txt` — adding a route automatically extends both surfaces; a CI test enumerates Astro's known routes and asserts coverage in both places. For source-MD pages (projects), the `.md` body is the raw source MD with frontmatter stripped and title prepended. For Astro-source pages (services, about, privacy), the `.md` body is a curated markdown sibling file maintained alongside the `.astro` file.

This phase lands the **MD-mirror validation criterion** from the PRD.

### Acceptance criteria

- [ ] A single helper module enumerates every renderable route in the site (excluding `/api/*`).
- [ ] Every enumerated route has a `.md` URL responding `200` with `Content-Type: text/markdown; charset=utf-8`.
- [ ] `/llms.txt` lists every enumerated route as `- [Title](https://auditmos.com/<path>.md): <one-line description>` plus a header block (site name, description, contact email).
- [ ] For source-MD pages (projects), the `.md` body is the raw frontmatter-stripped MD with the title prepended.
- [ ] For Astro-source pages (services, about, privacy), an `.md` sibling file is maintained alongside the `.astro` file with the canonical narrative for LLMs; the helper picks it up automatically.
- [ ] CI test: enumerate static routes via Astro's build-time route list, assert each has a matching `.md` URL and an `/llms.txt` entry. Adding a new page without wiring an MD twin fails the test.
- [ ] `robots.txt` references `/llms.txt`.
- [ ] Manual check: `curl https://staging.auditmos.com/llms.txt` returns the full index; `curl https://staging.auditmos.com/software-development.md` returns plain-text markdown.

---

## Phase 5: Contact form end-to-end

**User stories**: U10, U21, U22, U23, U24, U25

### What to build

The `/contact` page hosts a form (name, email, message) with the Cloudflare Turnstile widget. The Worker route at `/api/contact` accepts POSTs, validates with Zod at the boundary, verifies the Turnstile token via Cloudflare siteverify, sends two emails via Resend (a notification to `contact@auditmos.com` and a confirmation to the submitter), and returns a JSON response. The page handles success and error UI states (no redirects — the form submits via fetch and renders inline outcome).

The endpoint is atomic from the caller's perspective: either both emails succeed (200) or the endpoint returns 502. If the notification succeeds but the confirmation fails, a structured log captures the inconsistency and 502 is still returned — duplicate notifications on retry are acceptable; silent loss is not.

This phase lands the **contact endpoint validation criterion** from the PRD.

### Acceptance criteria

- [ ] `/contact` page renders the form, the Turnstile widget, and inline success / error containers. Form is keyboard- and screen-reader-accessible (labels, aria-describedby for errors, focus management on submit).
- [ ] Turnstile widget loads only on `/contact` — no other page ships its script.
- [ ] Wrangler secrets `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CONTACT_TO_EMAIL` set for staging and production; placeholder values removed.
- [ ] Resend domain verified for `auditmos.com` with DKIM and SPF passing in the Resend dashboard.
- [ ] Cloudflare Turnstile site key + secret generated for `auditmos.com` and `staging.auditmos.com`.
- [ ] End-to-end manual smoke test on staging: submit the form, both emails arrive in real inboxes within a minute.
- [ ] Vitest covers (against the extracted handler module, not the Astro page wrapper): valid payload + valid Turnstile → 200 + both emails dispatched; missing required field → 400 (no Turnstile call, no Resend call); malformed email → 400; missing/invalid Turnstile token → 403 (no Resend call); Resend 5xx on either email → 502; method other than POST → 405.
- [ ] Resend failure on the confirmation email after the notification succeeded → 502 returned to caller, structured log emitted noting the inconsistency.
- [ ] On client-side success the page shows a confirmation message and clears the form; on failure it shows an actionable error message and preserves the user's input.

---

## Phase 6: Open-source aggregator

**User stories**: U8, U9, U14, U33

### What to build

`/open-source` page lists repositories from the `github.com/auditmos` org as cards (name, description, primary language, star count, link). Data is fetched at build time via the GitHub REST API. The aggregator degrades gracefully: on rate-limit, network failure, or 5xx from GitHub, it falls back to the last successful response cached in the repo (or to an empty list with a build warning if no cache exists). The build never fails because of GitHub. Optionally a `GITHUB_TOKEN` is used to raise the unauthenticated rate limit.

This phase has no validation criterion in the PRD's "must-test" list, but a single unit test for the fallback path is included because the failure mode is operationally important (an OSS-page outage breaking unrelated deploys).

### Acceptance criteria

- [ ] Aggregator module exposes a typed function returning `OssProject[]` (`name`, `description`, `url`, `stars`, `language`, `updatedAt`).
- [ ] On a successful build, the aggregator fetches all public repos from `github.com/auditmos` (paginated if > 100), filters out archived/forks (configurable), sorts by stars descending or updated-at descending (chosen at implementation, documented).
- [ ] On GitHub API failure (any 4xx other than 404, any 5xx, network error, or rate-limit hit), the aggregator falls back to a `.cache/oss-projects.json` file checked into the repo and the build succeeds with a warning logged.
- [ ] If both the API and the cache fail, the page renders with an empty state ("Watch our work on [github.com/auditmos](…)") and the build still succeeds.
- [ ] `/open-source` page renders the cards with no client-side JavaScript.
- [ ] Vitest covers: aggregator returns mapped data on success; aggregator returns cached data on API failure; aggregator returns empty list when both fail; cache file is updated after a successful fetch.
- [ ] Optional `GITHUB_TOKEN` Wrangler env var is read at build time and bumps the rate limit when present.

---

## Phase 7: Production cutover

**User stories**: U37, U38, U39, plus the project-level "done" gate from the PRD

### What to build

The operational sequence that moves the new site from `staging.auditmos.com` to the production `auditmos.com` custom domain. No new product features — this phase exists to enforce that everything in phases 1–6 actually works against production-grade inputs (real DKIM/SPF, real Turnstile keys, real Worker env), and that the cutover causes no user-visible regression.

After cutover the old Worker stays hot for 7 days as a fallback in case any URL pattern was missed, then is decommissioned.

### Acceptance criteria

- [ ] DKIM + SPF DNS records for Resend added to `auditmos.com` and verified in the Resend dashboard.
- [ ] Production Cloudflare Turnstile site key + secret generated and stored as production Wrangler secret.
- [ ] Production Wrangler secrets fully populated: `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CONTACT_TO_EMAIL=contact@auditmos.com`, optional `GITHUB_TOKEN`.
- [ ] `contact@auditmos.com` inbox provisioned and confirmed receiving in production smoke test.
- [ ] Lighthouse run against the production Worker (via its workers.dev URL before the swap, or staging if pre-swap): Performance ≥ 95, Accessibility ≥ 95, SEO = 100, Best Practices ≥ 95 on home and a representative project page.
- [ ] `/llms.txt` and `.md`-mirror coverage tests pass in the production build.
- [ ] `auditmos.com` custom domain moved from the old Worker to the new Worker via the Cloudflare dashboard; transient < 60 s.
- [ ] Within 10 minutes of cutover: home page reachable on `auditmos.com`, contact form submission delivers both emails to real inboxes from the production environment.
- [ ] Old Worker remains deployed (not decommissioned) for 7 days as fallback. A 404 monitor / Cloudflare access-log review runs at day 1 and day 7; any old path appearing in inbound traffic that wasn't anticipated gets a 301 added to the new Worker or an explicit decision logged.
- [ ] Cloudflare Web Analytics shows production traffic within an hour of cutover.
- [ ] No broken-link reports from the old site for ≥ 7 days post-cutover; if any surface, they're triaged before old-worker decommission.
