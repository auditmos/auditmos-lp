# PRD — auditmos.com rebuild

**Status:** Draft · **Owner:** Tomasz Kowalczyk · **Drafted:** 2026-05-27
**Discovery transcript:** see memory `auditmos-rebuild-discovery`

## Problem Statement

The current auditmos.com is a thin placeholder. The people who actually visit it are not cold leads from search — they are prospects who already heard of Auditmos through referrals, LinkedIn, conferences, or partner introductions, and they come to **verify the company is legitimate** before responding to an outreach or replying to a quote. They leave with almost nothing: no project history, no team or company info beyond a registration number, no signal about what Auditmos can do, and no easy way to read the same information in a non-browser context (LLM/agent ingestion). The current funnel cannot convert that warm-introduction traffic into a meeting, and there is no surface for SEO long-tail capture on the three core service categories. Lead generation is not the bottleneck — **trust and substance are.**

## Solution

A net-new auditmos.com built as a **static-first** Astro 6 site deployed to a Cloudflare Worker, with:

- A focused information architecture that mirrors the three core service offerings (software development, R&D, security audits) as **separate pages** for SEO long-tail capture.
- A curated, file-based **projects** surface where every project is a markdown file in the repo. Adding a project = drop MD, commit, push. No CMS, no admin, no DB.
- An **open-source / tools** page auto-aggregated at build time from the `github.com/auditmos` organisation.
- A **single Worker route** (`/api/contact`) handling form submissions via Cloudflare Turnstile + Resend. Every other page is prerendered HTML served from edge cache with zero JS by default.
- A **dual-format publishing model**: every URL on the site has a `.md` twin (`/<path>.md`) returning `text/markdown`, plus a `/llms.txt` index — so LLMs and AI agents can ingest the entire site without scraping HTML.
- **Brand continuity:** colour (`#04d9ff`), logo lockups, and font carried over from the existing brand; nothing else.
- **No Polish localisation, no blog, no bios, no DB, no pricing page** in v1. Substance per page beats surface area.

Success looks like: a prospect arrives via a LinkedIn referral, lands on `/`, can in under 60 seconds (a) understand what Auditmos does, (b) verify it operates as Auditmos OÜ in Tallinn, (c) read at least one project case study relevant to their need, (d) reach a contact form that responds with a confirmation email. An LLM acting on the prospect's behalf can do the same via `/llms.txt`.

## User Stories

### Prospect — security audit lead

1. As a CISO evaluating audit vendors, I want to see what types of audits Auditmos performs, so that I can decide whether to invite them into our procurement process.
2. As a CISO, I want to see anonymised audit case studies (sector + outcome), so that I can gauge experience in regulated environments without needing client names.
3. As a CTO under an upcoming compliance deadline, I want to understand methodology and deliverables at a glance, so that I can predict scoping conversations.
4. As an EU-based security buyer, I want to verify the legal entity (name, VAT, registration, address), so that procurement can pass internal vendor-vetting.

### Prospect — software development lead

5. As a startup founder, I want to see software projects shipped with named clients (where allowed), so that I can verify quality and senior-level capability.
6. As a hiring manager looking for an outsourced partner, I want to see the technology stacks Auditmos uses, so that I can match them to my codebase.
7. As an EU buyer subject to GDPR, I want to confirm where data is processed and which providers are used, so that I can complete a DPA review.

### Prospect — R&D lead

8. As a research-grant applicant, I want to see prior R&D engagements and outputs, so that I can write a credible work-package description naming Auditmos as a partner.
9. As a corporate innovation lead, I want to skim open-source publications and tools, so that I can judge the depth of in-house research capability.

### Returning client / partner

10. As a returning client, I want to find the contact form quickly without re-reading the marketing copy, so that I can ask a follow-up question.
11. As a partner / reseller, I want a stable URL I can link from my own site, so that I can refer leads without breaking links over time.

### Journalist / due-diligence / recruiter

12. As a journalist, I want to find the legal entity, address, and contact email in the footer, so that I can cite Auditmos correctly.
13. As an investor or counterparty doing due diligence, I want to confirm the company actually operates a real public surface (no Lorem-ipsum placeholder), so that I can flag the entity as legitimate.
14. As a recruiter or candidate skimming the about + open-source pages, I want to get a sense of the company's technical depth, so that I can decide whether to reach out (note: bios are intentionally absent in v1 — recruiting is a secondary signal, not a goal).

### AI agent / LLM consumer

15. As an LLM acting on behalf of a user evaluating Auditmos, I want to fetch `/llms.txt` and discover every readable page, so that I can ingest the site without HTML parsing.
16. As an AI agent gathering vendor information, I want to GET `/services/security-audits.md` and receive `text/markdown`, so that I can answer the user's question with structured content.
17. As a search engine crawler, I want each service page to have unique meta + JSON-LD (`Organization`, `Service`), so that I can rank them for the right intents.

### Visitor — performance / accessibility

18. As a visitor on mobile data, I want the site to load fast on a constrained connection, so that I don't abandon before seeing the value proposition.
19. As a visitor using a screen reader, I want semantic HTML and meaningful alt text on the logo + any imagery, so that I can navigate the site.
20. As a visitor on an older browser, I want the site to render without JavaScript, so that I can still read the content (every page except `/contact` ships zero JS).

### Visitor — contact form

21. As a prospect filling the contact form, I want clear validation (missing email, malformed email), so that I don't waste a submission attempt.
22. As a prospect, I want a Cloudflare Turnstile challenge that is silent for most users, so that I don't experience reCAPTCHA-style friction.
23. As a prospect, I want a confirmation email after submitting, so that I know the form worked and I have a reply-to address.
24. As a prospect, I want the form to fail gracefully and show me an error message (not a blank page) if something breaks server-side, so that I can retry or contact via another channel.
25. As Auditmos staff, I want every successful submission delivered to `contact@auditmos.com`, so that I can respond from one inbox.

### Visitor — privacy

26. As a privacy-conscious EU visitor, I want to read a `/privacy` page that lists what data is collected, processors used (Resend, Cloudflare), retention, and my rights under GDPR, so that I can decide whether to submit the form.
27. As a privacy-conscious visitor, I want the site not to set tracking cookies or load third-party analytics, so that no consent banner is required.

### Author — Auditmos team member adding content

28. As an Auditmos team member, I want to add a new project by writing one markdown file in `src/content/projects/`, so that I don't have to learn a CMS.
29. As an Auditmos team member, I want the build to reject a malformed project file (missing title, invalid client shape) with a clear error, so that I catch typos before they reach production.
30. As an Auditmos team member, I want to publish a project under either a real client name (with permission) or a sector descriptor (anonymised, for NDA work), so that I can use the same pipeline for both confidentiality modes.
31. As an Auditmos team member, I want to push a project MD to `main` and see it live on production within minutes, so that publishing has no manual gate.

### Maintainer — Auditmos developer working on the site

32. As the site maintainer, I want every URL to have a matching `.md` twin generated by one source-of-truth helper, so that adding a new page never silently breaks the LLM surface.
33. As the site maintainer, I want the OSS aggregator to degrade gracefully when the GitHub API is rate-limited or down, so that an external outage never blocks a deploy.
34. As the site maintainer, I want CI to fail on `pnpm types`, `pnpm lint`, `pnpm knip`, or `pnpm test` errors before merge, so that `main` is always deployable.
35. As the site maintainer, I want all secrets (`RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CONTACT_TO_EMAIL`) stored as Wrangler secrets per env, so that they never appear in the repo or CI logs.
36. As the site maintainer, I want a `pnpm new-project "<title>"` script that scaffolds a new MD file with frontmatter prefilled, so that the marginal cost of adding a project is near zero.

### Operations — cutover

37. As the site owner, I want to deploy the new site to a `staging.auditmos.com` Worker first, so that I can verify everything end-to-end before swapping the production custom domain.
38. As the site owner, I want the cutover from old → new to be a single Cloudflare custom-domain swap with sub-minute downtime, so that visitors during the switch see at most a brief transient.
39. As the site owner, I want Resend's DKIM and SPF records added to auditmos.com DNS *before* go-live, so that confirmation emails don't land in spam on day one.

## Implementation Decisions

### Architecture spine (9 components)

The system is composed as nine deep modules with narrow interfaces:

1. **Content collection** — Astro Content Collections with a Zod schema for `projects`. Single typed interface: `getCollection('projects')` + `getEntry('projects', slug)`. Hides frontmatter parsing, MD rendering, slug derivation, and named-vs-anonymised client handling.
2. **Page routes** — Astro `.astro` pages, all `prerender = true` except `/api/contact`. URL → HTML. Hides layout composition, Tailwind utility composition, per-page SEO meta + JSON-LD.
3. **MD-mirror endpoint** — Single source-of-truth helper that lists every renderable page; `.md.ts` endpoints serve each one as `text/markdown`. `/llms.txt` is the index. Adding a new page automatically adds it to both surfaces; no manual sync.
4. **OSS aggregator** — Build-time fetch from `github.com/auditmos` org via GitHub REST API. Returns `OssProject[]` (name, description, stars, language, URL). Degrades gracefully on rate-limit or 5xx by returning the last-known list (cached at build) or an empty list, never failing the build.
5. **Contact endpoint** — `POST /api/contact` on a Cloudflare Worker. Composes (5a) Turnstile verifier and (5b) Resend mailer with Zod validation at the boundary. Returns JSON. No partial sends.
   - **5a. Turnstile verifier** — `verifyTurnstile(token, ip): Result<true, Error>`. Calls Cloudflare siteverify. Pure function (fetch injected for testability).
   - **5b. Resend mailer** — `sendContactEmails(payload): Result<true, Error>`. Sends both notification (to `contact@auditmos.com`) and confirmation (to submitter). Either both succeed or the endpoint returns 502.
6. **Layout + SEO** — `<Layout title description og? schema?>` wraps every page. Hides `<head>` tags, OG defaults, robots, sitemap inclusion.
7. **Brand tokens** — Tailwind v4 `@theme` block in `src/styles/globals.css`. Accent `#04d9ff`. Logo SVGs vendored from `github.com/auditmos/branding` into `src/assets/logos/`.
8. **CI/CD pipeline** — GitHub Actions on PR: `pnpm types && pnpm lint && pnpm knip && pnpm test`. On push to `main`: same + `wrangler deploy`. Secrets sourced from GitHub Actions secrets and projected into Wrangler env at deploy time.
9. **Sitemap + robots** — `@astrojs/sitemap` integration + static `public/robots.txt` (allow all, declare sitemap, declare `/llms.txt`).

### System boundaries

- **Build time:** GitHub REST API (OSS aggregator), MD content collection, brand SVG assets.
- **Request time (Worker, one route only):** Cloudflare Turnstile siteverify, Resend HTTP API. All other routes are static HTML served from edge cache.
- **Browser (one page only):** `/contact` loads the Turnstile widget script; every other page ships zero JS by default.

### Third-party services

- **Cloudflare:** Workers (host), Turnstile (anti-spam), Web Analytics (privacy-respecting, no cookies, no consent banner needed). DNS already on Cloudflare.
- **Resend:** transactional email for the contact form. Sender `noreply@auditmos.com` (requires DKIM + SPF on auditmos.com DNS — *blocker before launch*). Two emails per submission: notification to `contact@auditmos.com` + confirmation to submitter.
- **GitHub:** repo host, Actions CI/CD, REST API for OSS aggregator. Optional `GITHUB_TOKEN` for higher rate limits at build time.

### Data flows

1. **Visitor → page:** edge cache → prerendered HTML → 0 JS (Turnstile only on `/contact`).
2. **Visitor → contact:** `POST /api/contact` → Worker → Zod parse → Turnstile verify → Resend send (notification + confirmation, atomic) → JSON response → success/failure UI.
3. **Author → new project:** edit MD in `src/content/projects/` → `git push main` → GitHub Actions → `wrangler deploy` → live.
4. **AI agent → site:** `GET /llms.txt` → index of every URL with `.md` counterparts → `GET /<path>.md` → `text/markdown`.

### Confidentiality model for projects

The `projects` Zod schema has a `client` field accepting either:

- `{ name: string, url?: string }` — public, named (OSS, R&D, named-with-permission client work)
- `{ sector: string }` — anonymised (e.g. `"Banking"`, `"FinTech"`, `"Public sector"`)

The schema validates that exactly one shape is present. The rendering layer reads which variant and emits either the client name + logo (if URL) or the sector descriptor.

### Pages and routes

| Path | Type | Purpose |
|---|---|---|
| `/` | Prerendered | Hero + 3 service teasers + featured projects + contact CTA |
| `/software-development` | Prerendered | Service detail page, SEO target |
| `/r-and-d` | Prerendered | Service detail page, SEO target |
| `/security-audits` | Prerendered | Service detail page, SEO target |
| `/projects` | Prerendered | Index of all projects (filterable by service/sector) |
| `/projects/[slug]` | Prerendered | Project detail page, generated from MD |
| `/about` | Prerendered | Company-only — mission, values, entity |
| `/open-source` | Prerendered | Auto-aggregated repos from `github.com/auditmos` |
| `/contact` | Prerendered | Form + Turnstile widget |
| `/privacy` | Prerendered | GDPR baseline copy |
| `/api/contact` | Worker (POST only) | Form submission handler |
| `/<path>.md` | Prerendered | Markdown twin of every URL above (except `/api/contact`) |
| `/llms.txt` | Prerendered | Index for AI agents |
| `/sitemap.xml` | Prerendered | Search engine sitemap |
| `/robots.txt` | Static | Crawler directives |

### Footer

Mirrors current auditmos.com legal block exactly: Auditmos OÜ · Registration 17025406 · VAT EE102758111 · Narva mnt 13-27, 10151 Tallinn, Estonia. Plus: link to `/privacy`, link to `contact@auditmos.com`.

## Validation Strategy

Validation focus per the discovery decision: **Contact endpoint** + **MD-mirror endpoint** + **Content collection schema**. Other components are verified visually (pages) or by CI passing (CI/CD itself).

### Contact endpoint (components 5, 5a, 5b)

Vitest tests against the endpoint's exported handler function (extracted from the Astro page per the repo's testing convention). Done when:

- Valid payload + valid Turnstile token → `200 { ok: true }`, both emails dispatched to Resend (mocked client asserted to be called twice).
- Missing required field → `400 { error: <field message> }`. No Turnstile call. No Resend call.
- Malformed email → `400 { error: ... }`. No downstream calls.
- Missing or invalid Turnstile token → `403 { error: "Anti-spam verification failed" }`. No Resend call.
- Resend returns 5xx on either email → endpoint returns `502 { error: "Email delivery failed" }`. **No partial sends are observable from outside.** (Implementation note: send notification first, then confirmation; if confirmation fails after notification succeeded, log the inconsistency but still return 502 so the user retries — duplicate notifications are acceptable, silent loss is not.)
- Rate-limited Turnstile token (reuse) → `403`. No Resend call.
- Method other than POST → `405`.

### MD-mirror endpoint + `/llms.txt` (component 3)

Build-time + integration assertions. Done when:

- For every Astro page (excluding `/api/*`), a `.md` URL exists and returns `200` with `Content-Type: text/markdown; charset=utf-8`.
- `/llms.txt` lists every such URL with its title and a one-line description.
- A test enumerates the static route list from Astro and asserts (a) each has a `.md` counterpart and (b) each appears in `/llms.txt`. Adding a new page without wiring it in fails the test.
- The `.md` body for an MD-source page (e.g. a project) is the raw source MD (frontmatter stripped, title prepended).
- The `.md` body for an Astro-source page (e.g. `/software-development`) is a curated markdown version maintained alongside the `.astro` file (an `.md` sibling), or is generated from a small section-tree spec — final choice deferred to implementation but the test asserts coverage either way.

### Content collection schema (component 1)

Zod-on-build. Done when:

- A project MD missing `title`, `slug`, `summary`, or both `client.name` and `client.sector` → `astro build` fails with a clear field-level error pointing to the offending file.
- A project MD with both `client.name` and `client.sector` simultaneously → build fails.
- A valid project MD with `client.name` → renders with the name on `/projects/<slug>`.
- A valid project MD with `client.sector` → renders with the sector descriptor on `/projects/<slug>`.
- The frontmatter schema is the single source of truth for project listings, detail pages, structured data, and the home page "featured" carousel.

### Other quality gates (lighter)

- **Lighthouse** on `/` and `/projects/[slug]` (representative pages): Performance ≥ 95, Accessibility ≥ 95, SEO = 100, Best Practices ≥ 95. Run manually before launch.
- **Page weight:** every prerendered page ≤ 50 KB transferred (HTML + CSS + image lazy-load thresholds), excluding `/contact` which adds the Turnstile widget (~20 KB).
- **First Contentful Paint** on cold cache (3G throttle): < 1.5 s. Measured via Chrome DevTools.
- **CI gates:** `pnpm types`, `pnpm lint`, `pnpm knip`, `pnpm test` all pass on every PR.

### Done definition for the project as a whole

The PRD is delivered (v1 shipped) when:

- All routes in the page table render correctly on staging.auditmos.com.
- The contact form successfully delivers both emails to a real `contact@auditmos.com` inbox and a real submitter inbox (manual end-to-end test).
- DKIM + SPF records pass Resend verification.
- Lighthouse thresholds met on home + a representative project page.
- The `.md`-mirror coverage test passes.
- The content-collection schema test passes.
- Cloudflare Web Analytics is wired and reporting traffic on staging.
- The cutover to production custom domain completes with no broken-link reports from the old site for ≥ 7 days (use a simple 404 monitor; out-of-scope old paths can 301 to `/` or 404 — confirm at cutover).

## Out of Scope

The following are explicitly **not** in v1 — they may be revisited later but should not influence v1 design:

- **Blog / regular content publishing pipeline.** Use-case writeups land as projects; standalone editorial is not a v1 goal.
- **Individual team bios, photos, team page.** Company-only positioning is intentional.
- **Polish, Estonian, or any non-English localisation.** Single-locale site.
- **Pricing page or engagement-model breakdown.** Pricing happens via conversation, not the site.
- **CMS, admin UI, or web-based content editor.** Pure git workflow is the explicit design.
- **Database, user accounts, authentication.** No persistent state beyond static files + form-submission emails.
- **Newsletter signup, lead-magnet downloads, gated content.**
- **Live chat, chatbot, or AI assistant on-site.**
- **Calendly / Cal.com embed.** Contact form is the only conversion surface in v1.
- **Plausible / Fathom / Google Analytics.** Cloudflare Web Analytics is the chosen single source.
- **Custom CMS-style frontmatter UI** (e.g. Decap, Tina). Markdown + git only.
- **Automated screenshots or social-card image generation per project.** OG images are manually authored if needed.
- **Cross-org open-source aggregation.** Only `github.com/auditmos` is pulled.
- **Webhook-triggered rebuilds on GitHub org changes.** OSS list refreshes on the next site deploy (or on a future cron — see Further Notes).

## Further Notes

### Cutover sequence (operational checklist, not in PRD scope but referenced)

1. Deploy new Worker to `staging.auditmos.com` (CF custom domain on the staging Worker name).
2. Add Resend domain + DKIM + SPF DNS records on auditmos.com. Verify in Resend dashboard.
3. Generate Cloudflare Turnstile site key + secret for `auditmos.com` (and `staging.auditmos.com`).
4. Populate Wrangler secrets per env: `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CONTACT_TO_EMAIL`, optional `GITHUB_TOKEN`.
5. Run end-to-end contact-form smoke test on staging → verify both emails arrive.
6. Verify Lighthouse + page-weight thresholds.
7. Verify `/llms.txt` + `.md` mirror coverage.
8. Move `auditmos.com` custom domain from the old Worker to the new Worker. (CF custom-domain swap; sub-minute transient.)
9. Old Worker remains live for 7 days as a fallback, then is decommissioned.
10. Monitor CF Web Analytics for traffic + any 404 spike. If old URLs surface, add 301 redirects or a static 404 page.

### Future work (not committed)

- **CF Cron Trigger** for daily OSS refresh — useful if `github.com/auditmos` activity becomes a meaningful credibility surface and freshness matters between deploys.
- **OG image auto-generation** per project (Astro Image Service + a template). Manual until volume justifies.
- **Lighter contact-form variants** with service-of-interest dropdown — defer until form submission volume exists to optimise.
- **301 redirect map** from old site URLs if any of them are linked externally and matter for SEO continuity. Discover via Search Console after cutover.
- **Polish localisation** if domestic R&D-grant work justifies it. Schema-wise the content collections support a `lang` field cleanly when needed.

### Pre-launch blockers (not optional)

- DKIM + SPF records on auditmos.com DNS, verified in Resend.
- Cloudflare Turnstile site key + secret generated and stored as Wrangler secret.
- `contact@auditmos.com` inbox provisioned and monitored.
- Decision on what happens to old auditmos.com paths at cutover (probably no path-level mapping required since the old site has almost no deep content, but verify via Search Console / Cloudflare access logs).

### Memory references

- Discovery decisions: `auditmos-rebuild-discovery`
- Legal entity / footer data: `auditmos-entity`
- Branding repo + accent colour: `auditmos-branding-repo`
