# PRD — Agent Coverage for the Web

**Status:** Draft · **Owner:** Tomasz Kowalczyk · **Drafted:** 2026-08-07
**Discovery:** ask-skill interview 2026-08-07 + memory `agent-readiness-100-goal`
**Issues:** PRD [#19](https://github.com/auditmos/auditmos-lp/issues/19) · Phases [#20–#25](https://github.com/auditmos/auditmos-lp/issues) · Plan: [`plans/agent-coverage.md`](../plans/agent-coverage.md)
**Sequencing:** starts **after** [`prd-agent-readiness-100.md`](./prd-agent-readiness-100.md) ships and verifies (interview Q5).

## Problem Statement

AI agents already visit auditmos.com — GPTBot, ClaudeBot, Perplexity, MCP clients, markdown-negotiating fetchers — and neither Auditmos nor any prospective client can see it. Existing analytics count *humans*; agent traffic is either filtered out as "bots" or lumped invisibly into noise. Businesses being pitched on agent-readiness have no instrument that shows the problem exists, and no metric that shows progress once they invest.

Meanwhile, Trail of Bits' [`agentcov`](https://github.com/trailofbits/agentcov) ("gcov for what lines of code agents read") established coverage semantics for AI consumption of a *repository*: per-line read counts, LCOV/HTML reports, an `unread` list. Nobody has applied that idea to the *web* — and this repo is uniquely positioned to do it first:

- Every page already has a **line-addressable markdown twin** — a canonical "source file" per URL, so a page read maps to `ranges: ["about.md:1:118"]` honestly, not metaphorically.
- `src/site/pages.ts` is already the **single source of truth mapping URL ↔ source** — the exporter's page map exists.
- `src/worker.ts` already sees **every page request** (`run_worker_first`) — the capture point exists at zero added latency.
- `agentcov import` accepts plain `{"cmd": "...", "ranges": [...]}` JSON — the reporting engine is a format adapter away.

The product this creates — **"Agent Coverage %"** as a named, ownable metric, a coverage heatmap of a website, a "dead content report" of pages no agent has ever read — is the differentiated demo artifact the Auditmos pitch needs, and its measurement layer is the seed of a sellable audit deliverable.

## Solution

A five-stage pipeline, live on auditmos.com and **public from day one** (interview Q2 — sparse early data is honest evidence, not embarrassment):

1. **Capture** — classify every request at the edge in `src/worker.ts`; write data points to Workers Analytics Engine via `ctx.waitUntil` (zero request latency).
2. **Classify** — table-driven agent identification with two honesty tiers: **verified** (MCP calls, markdown content negotiation, Cloudflare verified-bot data where available) vs **claimed** (user-agent match only). An audit brand publishes its methodology; tiers are always visible.
3. **Roll up** — a daily Cron Trigger aggregates Analytics Engine (90-day retention) into D1 (permanent daily aggregates).
4. **Export & report** — a nightly CI job runs the **site-agnostic exporter** (page map + aggregates → agentcov import JSON), then `agentcov` itself (`import` → `html`/`summary`/`unread`), and commits the generated report into the site as static assets.
5. **Present** — `/coverage` (the agentcov-rendered heatmap, headline Agent Coverage %, dead-content list, methodology), `/observatory` (live counters + recent agent activity feed), a badge SVG, and an MCP tool `get_agent_coverage` so visiting agents can query what other agents read — the meta-demo.

Two scope decisions from discovery shape the architecture:

- **Site-agnostic pipeline, manual client pilot in scope** (Q4): the exporter takes `(domain, pageMap, events)` with no auditmos-specific imports, and v1 includes producing one private coverage report for a friendly external site from their logs — proving the audit deliverable without productizing anything.
- **OSS-after-proof** (Q3): everything lives in this repo for v1. Extracting the exporter into a public `github.com/auditmos` repo and approaching Trail of Bits with a *working demo* (upstream "web import" recipe) are explicit follow-ups gated on `/coverage` being live with real data.

Success looks like: a prospect opens `/observatory`, watches agent traffic exist, opens `/coverage`, sees a gcov-style report of a *website* for the first time, and the pitch line — *"you have test coverage for your code; what's your agent coverage?"* — lands with a live artifact behind it.

## User Stories

### Prospect / pitch audience

1. As a business owner being pitched, I want to see live proof that AI agents visit websites and consume specific content, so that "agent traffic is real" stops being an assertion.
2. As a technical evaluator, I want the coverage report in a format I already know how to read (coverage heatmap, percentage, unread list), so that I grasp the metric in seconds.
3. As a skeptical evaluator, I want the methodology page to distinguish verified from claimed agent traffic, so that I can trust the numbers aren't inflated.

### Auditmos (founder / sales)

4. As the founder, I want a headline "Agent Coverage: N%" badge and heatmap on my own domain, so that every pitch, post, and talk has a screenshot no competitor has.
5. As the founder, I want the "dead content report" (pages zero agents have read), so that I can demonstrate the content-ROI conversation on my own site before selling it.
6. As the founder, I want to run the same pipeline manually against one friendly client's site and hand them a private report, so that the audit deliverable is validated before productization.

### AI agent

7. As an MCP client, I want a `get_agent_coverage` tool, so that I can query aggregate agent-readership of this site programmatically.
8. As any agent, I want `/coverage` and `/observatory` listed in llms.txt with markdown twins, so that the reports themselves are agent-readable.

### Maintainer

9. As the site maintainer, I want capture to add zero latency and fail open (a classifier error must never break a page response), so that the Observatory can never degrade the site.
10. As the site maintainer, I want daily rollups to be idempotent, so that a re-run after a failed cron cannot double-count.
11. As the site maintainer, I want the agent-UA table to be a data module with tests, so that adding a new crawler is a one-line change.
12. As the site maintainer, I want the nightly report job to fail loudly in CI but never block site deploys, so that reporting and shipping stay decoupled.

## Implementation Decisions

### Architecture spine

1. **Edge capture** — `src/coverage/capture.ts`: a pure function `(request, response, classification) → DataPoint` wired into `src/worker.ts` beside the markdown-negotiation wrapper, written via `ctx.waitUntil(env.AGENT_COVERAGE.writeDataPoint(...))`. Dimensions: path, surface (`html` | `md-twin` | `negotiated-md` | `llms-txt` | `mcp` | `well-known` | `oauth`), agent family, tier, HTTP status. New **Analytics Engine binding `AGENT_COVERAGE`** in all three env blocks (requires Workers Paid — confirm plan before starting; the site's existing Worker likely already qualifies). Fail-open: capture is wrapped so any error is swallowed and the response proceeds untouched.

2. **Classifier** — `src/coverage/classify.ts` + `src/coverage/agents-table.ts` (data module: UA patterns → agent family). Signals, strongest first: `POST /mcp` (unambiguously an agent → **verified**); `Accept: text/markdown` negotiation (**verified**); Cloudflare verified-bot metadata when present on the request (**verified**; guarded, plan-dependent); known AI UA match (**claimed**); everything else → human/unclassified, counted only in totals. Pure, table-driven, exhaustively unit-tested. The tier taxonomy is part of the public methodology.

3. **Rollup** — a `scheduled` handler in the Worker entry (Cron Trigger, daily): queries the Analytics Engine SQL API for the previous day, upserts into **D1** table `daily_agent_reads (date, path, surface, agent, tier, reads)` with a primary key on the dimension tuple — idempotent by construction. D1 is the permanent store; Analytics Engine's 90-day retention stops mattering after each rollup. New bindings: `COVERAGE_DB` (D1) + cron trigger, all three env blocks, `pnpm cf-typegen` after.

4. **Exporter (the site-agnostic boundary)** — `src/coverage/export.ts`: `(domain, PageMap, AggregateRow[]) → { agentcovImport, summary }` where `PageMap = { url, sourceFile, lineCount }[]`. Emits agentcov import entries — `{"cmd": "GET /about (ClaudeBot, verified)", "ranges": ["about.md:1:118"]}` — plus a summary JSON (coverage %, per-page counts, unread list, tier split). **No imports from the rest of the codebase**; auditmos's own PageMap is built *outside* the module from `src/site/pages.ts` + line counts of the built markdown twins. A fixture test runs the exporter on a synthetic foreign site to enforce the boundary (interview Q4: the manual client pilot must need zero rework).

5. **Report generation** — nightly GitHub Actions workflow: `wrangler d1 execute` (or REST) pulls aggregates → `tsx` runs the exporter → `uv tool run agentcov` (pinned version) runs `import` + `html` + `summary` + `unread` → outputs land in `public/coverage/` → commit + push triggers the normal deploy. Chosen over R2 upload because commit-to-repo keeps the whole artifact in the site's git+static model: versioned history of every nightly report for free, and `/coverage` stays a prerendered surface. The workflow failing never blocks other deploys.

6. **`/coverage` page** — prerendered Astro page framing the generated artifacts: headline Agent Coverage %, the agentcov HTML heatmap (linked/embedded), the unread ("dead content") list, tier split, and a **methodology section** (classification rules, tier definitions, granularity honesty — see 8). Has an `.md` twin and llms.txt entry like every page. Badge at `/coverage/badge.svg`, generated in the nightly job (shields-style, coverage % + color band).

7. **`/observatory` page** — prerendered page + one new request-time route `GET /api/observatory` returning recent aggregates from D1 (today's counters + last-N agent events at aggregate level), cached via the Cache API with a short TTL (60 s) so D1 sees a trickle, not traffic. The page ships a small vanilla-JS fetch to hydrate the live numbers — a **documented exception to zero-JS** (the page's entire purpose is live data; no framework, no island, ≤ 2 KB). **Static-first exception documented here per project convention:** live counters cannot be prerendered; the route is read-only, cacheable, and public-aggregate-only.

8. **Honesty constraints (product requirements, not implementation details):**
   - Published data is **aggregate only**: no IPs, no session identifiers, no per-request logs on any public surface.
   - Verified vs claimed tiers are always displayed, never merged into one inflated number.
   - Granularity honesty: a full-page fetch is **file-level** coverage rendered as `1:N` ranges; the site never claims line-level insight for page fetches. Section-level granularity is only ever claimed for genuinely granular surfaces (MCP tools returning specific content) — future work.
   - The methodology page states all of the above; an audit brand's instrument must show its calibration.

9. **MCP tool** — `get_agent_coverage` added to the tool registry (`src/mcp/tools.ts`): returns the latest summary JSON (headline %, top pages, unread count, tier split) from the committed report data. Derived from the registry as always, so `/agents.json` and the A2A card advertise it automatically.

### System boundaries

- **Build time:** PageMap derivation from `pages.ts` + built twins; `/coverage` page renders the last committed report.
- **Request time (Worker):** capture (fire-and-forget), `GET /api/observatory` (D1 read, cached). The rendered-route set grows by one read-only GET.
- **Scheduled (Worker):** daily Analytics Engine → D1 rollup.
- **CI (GitHub Actions, nightly):** export → agentcov → commit `public/coverage/`. Python/`uv` exists only here — never in the serve path.
- **Manual (pilot):** foreign-site PageMap from a crawl of the client's pages; events from their Worker snippet or Logpush export; exporter + agentcov run locally; deliverable is a private report.

### Third-party services

- **Cloudflare:** Workers Analytics Engine (new), D1 (new), Cron Triggers (new), existing Workers host. Web Analytics stays for human traffic — this system deliberately does not replace it.
- **Trail of Bits `agentcov`:** PyPI, pinned version, CI-only. Upstream engagement deferred (Q3).
- **GitHub Actions:** nightly report workflow; needs a Cloudflare API token secret scoped to D1 read.

### Data flows

1. **Agent → page:** request → Worker → classify → `writeDataPoint` (async) → response unchanged.
2. **Nightly:** cron rollup AE → D1; CI pulls D1 → exporter → agentcov → `public/coverage/` commit → deploy.
3. **Human → `/observatory`:** prerendered shell → cached `/api/observatory` fetch → live counters.
4. **Agent → coverage:** `/coverage.md`, or MCP `get_agent_coverage` → summary JSON.
5. **Pilot client:** their logs + crawl → exporter (unchanged) → private report.

## Validation Strategy

### Classifier (component 2)

Table-driven Vitest fixtures. Done when:

- Every entry in the agents table classifies to the expected family and tier.
- MCP POSTs and `Accept: text/markdown` negotiation classify as verified regardless of UA.
- Unknown UA → unclassified; classifier never throws on malformed/absent headers (fuzz fixtures).

### Exporter (component 4)

Done when:

- A fixture `(pageMap, aggregates)` produces byte-stable agentcov import JSON with correct `1:N` ranges and tier-annotated `cmd` strings.
- The **foreign-site fixture** (synthetic domain, pages that don't exist in this repo) exports correctly — proving no hidden coupling.
- Unread pages appear with zero-read entries so agentcov's `unread` sees them (the page map, not traffic, defines the universe).
- A CI smoke step runs real `agentcov import` + `summary` on the fixture export and asserts a non-empty parseable result — catching upstream format drift at the pin boundary.

### Rollup & API (components 3, 7)

Done when:

- Upsert logic proven idempotent: replaying the same day twice yields identical row counts (D1 fixture test at the module boundary).
- `/api/observatory` returns aggregate-only JSON (schema-asserted: no IP-shaped or UA-raw fields), sets cache headers, and answers `405` on non-GET.

### End-to-end / Done definition

- Synthetic agent requests against staging (curl with GPTBot UA, an MCP call, a markdown negotiation) appear in Analytics Engine, survive rollup into D1, and appear in the next generated report with correct tiers.
- `/observatory` and `/coverage` live on **production**, linked in nav/llms.txt, with ≥ 7 days of real data and 7 consecutive green nightly runs.
- Badge renders; `get_agent_coverage` answers over `/mcp`.
- One **pilot report** delivered for one external domain from real log data (Q4).
- `pnpm types && pnpm test && pnpm lint && pnpm knip` green; ≤ 500 lines per file; `pnpm agents:verify` still green (no regression to the 100/100 surface).

## Out of Scope

- **Productized client snippet / self-serve onboarding** — v1 proves the pipeline on our site plus one manual pilot; packaging is a future PRD.
- **OSS repo + Trail of Bits upstream PR** — explicit follow-ups, gated on `/coverage` live with real data (Q3). Not v1 deliverables.
- **Real-time streaming (WebSockets/SSE)** — 60 s cached polling is enough theater; Durable Objects stay out.
- **Line-level claims for full-page fetches, scroll/attention analytics, per-visitor tracking** — excluded by the honesty constraints.
- **Replacing Cloudflare Web Analytics** — human analytics unchanged.
- **Historical backfill** — coverage starts at instrumentation day zero; the "since <date>" label is part of the story.

## Further Notes

### Risks

- **UA spoofing:** anyone can claim to be GPTBot — mitigated by the tier system, never fully solved until Web Bot Auth adoption; revisit classification when signatures arrive.
- **Workers plan dependency:** Analytics Engine requires Workers Paid — verify before scheduling the work.
- **Low early volumes:** expected; the public-from-day-one decision (Q2) makes sparse data part of the narrative, not a launch blocker.
- **agentcov upstream drift:** pinned version + CI smoke test on the real binary; the import format is small enough to vendor a fallback renderer if the project ever turns.

### Vocabulary (deliberate, brand-owned)

"**Agent Coverage**" (the metric), "**dead content report**" (`unread` applied to a site), "**catalog coverage**" (the ecommerce-pitch variant: % of SKUs ever read by an agent). Naming ships in the copy of `/coverage` — whoever names the metric frames the market.

### Follow-ups queued behind v1 (not committed)

- Extract exporter → public `github.com/auditmos/<name>` repo (feeds the open-source page) + upstream "web import" recipe issue/PR on `trailofbits/agentcov`, opened with the live demo as the first line.
- Coverage-diff deploy gate: new page ships with zero agent-surface wiring → CI warning (the "uncovered new code" analogy).
- Section-level granularity via MCP tool responses.
- Productization PRD (client snippet, per-client report generation, pricing).

### Memory references

- Scanner + goal context: `agent-readiness-100-goal`
- Architecture context: `auditmos-rebuild-discovery`
