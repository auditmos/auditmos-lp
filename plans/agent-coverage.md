# Plan: Agent Coverage for the Web

> Source PRD: `docs/prd-agent-coverage.md`

**Sequencing:** this work starts only after `docs/prd-agent-readiness-100.md` ships and verifies (PRD header, interview Q5). The plan is self-contained — it depends on that PRD's *completion*, not on its plan's contents. The only hard technical prerequisite it inherits is that the agent surfaces being measured (md twins, `/llms.txt`, `/mcp`, well-known files) already exist and `pnpm agents:verify` is green.

## Architectural decisions

Durable decisions that apply across all phases. These should not change as later phases are built; if a phase needs to revisit one, raise it before proceeding.

- **Pipeline shape**: five sequential stages — edge capture → classification → daily rollup → nightly export/report → presentation. Each stage persists into the next stage's input (Analytics Engine → D1 → committed static artifacts), so every phase below is verifiable at its own storage boundary.
- **Capture is fail-open and zero-latency**: classification + `writeDataPoint` happen inside the Worker fetch path via `ctx.waitUntil`, wrapped so *any* error is swallowed and the response proceeds untouched. Capture may never alter a response, add measurable latency, or throw. This is a product requirement (story S9), enforced by test in Phase 1 and re-asserted by every later phase.
- **Two honesty tiers, aggregate-only publishing**: every event is **verified** (MCP call, markdown content negotiation, Cloudflare verified-bot metadata) or **claimed** (UA match only); everything else is unclassified and counted only in totals. Tiers are never merged into one number on any public surface. No IPs, session identifiers, or per-request logs are ever published. Granularity honesty: full-page fetches are file-level coverage rendered as `1:N` ranges — the site never claims line-level insight for them. These constraints bind every phase, not just the methodology page.
- **Data model**: Analytics Engine data points carry dimensions `(path, surface, agent family, tier, HTTP status)` where surface ∈ `html | md-twin | negotiated-md | llms-txt | mcp | well-known | oauth`. The permanent store is D1 table `daily_agent_reads (date, path, surface, agent, tier, reads)` with a primary key on the full dimension tuple — idempotent upsert by construction. AE's 90-day retention stops mattering after each rollup; D1 is the system of record.
- **Per-env isolation**: the `AGENT_COVERAGE` Analytics Engine binding and the `COVERAGE_DB` D1 binding exist in all three env blocks with *distinct* datasets/databases per env, so staging synthetic traffic can never pollute production data. Bindings are not inherited by named envs (same pitfall as `MCP_RATE_LIMITER`) — repeat them per block, run `pnpm cf-typegen` after every `wrangler.jsonc` change.
- **Plan dependency**: Workers Analytics Engine requires Workers Paid — confirmed before Phase 1 starts, not discovered mid-phase.
- **The exporter is the site-agnostic boundary**: `(domain, PageMap, AggregateRow[]) → { agentcovImport, summary }` with `PageMap = { url, sourceFile, lineCount }[]` and **zero imports from the rest of the codebase**. Auditmos's own PageMap is built *outside* the module (page enumerator + line counts of built markdown twins). A foreign-site fixture test enforces the boundary so the Phase 6 pilot needs no rework. The page map — not traffic — defines the coverage universe: unread pages get zero-read entries.
- **Reports are git-committed static artifacts**: the nightly GitHub Actions job pulls D1 aggregates, runs the exporter, runs a **pinned** `agentcov` (`uv`, CI-only — Python never enters the serve path), and commits outputs to `public/coverage/`. Chosen over R2 because commit-to-repo keeps the artifact inside the site's git+static model: versioned nightly history for free, `/coverage` stays prerendered. The job fails loudly (red run) but nothing else depends on it — reporting and shipping stay decoupled. Nightly commits use a `chore(...)` type so semantic-release ignores them.
- **System boundaries**: build time (PageMap derivation, `/coverage` rendering from the last committed report) · request time (capture fire-and-forget + exactly one new read-only route, `GET /api/observatory`) · scheduled (daily AE → D1 rollup in the Worker's `scheduled` handler) · CI (nightly export/report) · manual (pilot). The rendered-route set grows by exactly one GET; the static-first exception is documented in the PRD.
- **AE SQL API access is token-based**: there is no in-Worker query binding for Analytics Engine — the rollup queries the SQL API over HTTPS with a Cloudflare API token stored as a Worker secret; the nightly CI job needs a separate token scoped to D1 read stored as a GitHub Actions secret. Both tokens are minimally scoped.
- **Capture coverage requires routing coverage**: `run_worker_first` currently lists only page routes — `.md` twins, `/llms.txt`, and well-known agent files are answered by the asset server and the Worker never sees them. Every surface in the capture dimension set must be added to `run_worker_first` (a routing hop, not a render — the prerendered asset still serves). The build-output test guarding that list is updated in the same change.
- **New pages follow every existing site convention**: `prerender = true`, `.md` twin + `/llms.txt` entry (MD-mirror CI test enforces), `run_worker_first` entry, slash-free canonical URL, `Vary: Accept` untouched, legal footer. `/coverage` ships no JS; `/observatory` ships a documented exception — ≤ 2 KB vanilla JS, no framework, no island, because live counters cannot be prerendered.
- **Observatory reads are cached**: `GET /api/observatory` serves aggregate-only JSON from D1 through the Cache API with a ~60 s TTL, so D1 sees a trickle regardless of page traffic. Read-only, public-aggregate-only, `405` on non-GET.
- **MCP tool via the registry**: `get_agent_coverage` is added to the existing tool registry and returns the latest *committed* summary JSON — so `/agents.json` and the server card advertise it automatically and the tool needs no runtime D1 access.
- **`agents:verify` stays green and grows**: no phase may regress the existing agent-readiness surface; when a phase ships a new agent surface, its check is added to `REQUIRED_CHECKS`.
- **Vocabulary ships in copy**: "Agent Coverage" (the metric), "dead content report" (`unread` applied to a site), "since \<date\>" (no historical backfill — day-zero instrumentation is part of the story).
- **Out of scope for every phase**: OSS extraction of the exporter, Trail of Bits upstream engagement, real-time streaming, per-visitor tracking, self-serve client onboarding. The first two are queued follow-ups gated on `/coverage` being live with real data.

---

## Phase 1: Edge capture live in production

**User stories**: S9 (zero-latency fail-open capture), S11 (agents table as a tested data module), foundation for S3 (tier taxonomy)

### What to build

The full capture path, deployed to production: a pure, table-driven classifier (signals strongest-first: MCP POST → verified; `Accept: text/markdown` negotiation → verified; Cloudflare verified-bot metadata when present → verified; known AI UA → claimed; else unclassified) feeding a fail-open capture step in the Worker entry that writes dimension-tagged data points to a new Analytics Engine binding via `ctx.waitUntil`. The complete agents table ships now, not later — classification happens at capture time and is never retroactive, so every week of a thin table is a week of degraded permanent data.

This phase also closes the routing gap: `.md` twins, `/llms.txt`, and well-known agent files are added to `run_worker_first` so the surfaces being measured actually pass through the Worker. Production deploy is part of *this* phase — the "since \<date\>" clock and the 7-day soak gate in Phase 6 both start ticking here.

Demo: three synthetic curls against staging (GPTBot UA, an MCP `initialize`, a markdown negotiation) appear in the Analytics Engine SQL API with the correct family, tier, and surface.

### Acceptance criteria

- [ ] Workers Paid plan confirmed for the account before any binding work (Analytics Engine hard requirement).
- [ ] Classifier is a pure function over `(request, routing signals)` backed by an agents-table data module (UA pattern → agent family); adding a crawler is a one-line table change.
- [ ] Table-driven Vitest fixtures: every table entry classifies to the expected family and tier; MCP POSTs and markdown negotiation classify **verified** regardless of UA; Cloudflare verified-bot metadata is consumed only when present (guarded, plan-dependent); unknown UA → unclassified; fuzz fixtures prove the classifier never throws on malformed or absent headers.
- [ ] `AGENT_COVERAGE` Analytics Engine binding present in all three env blocks with a distinct dataset per env; `pnpm cf-typegen` run; data points carry `(path, surface, agent family, tier, status)`.
- [ ] Capture is wired in the Worker entry beside the markdown-negotiation wrapper, writes via `ctx.waitUntil`, and is wrapped fail-open: a test proves an injected classifier/write error leaves the response byte-identical and successful.
- [ ] `run_worker_first` extended to cover every captured surface (`.md` twins, `/llms.txt`, well-known agent files); the build-output test guarding the list is updated and green; markdown negotiation and asset serving behave identically before/after (verified with `pnpm preview`).
- [ ] Synthetic agent requests against staging appear in the AE SQL API within minutes, with correct family/tier/surface — including one `unclassified` control request.
- [ ] Deployed to **production**; first data points confirmed; the instrumentation start date recorded for the "since \<date\>" label.
- [ ] No measurable latency added to page responses (spot-check: response timing on a captured route is indistinguishable from an uncaptured baseline).
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green; `pnpm agents:verify` green (no regression).

---

## Phase 2: Durable daily aggregates

**User stories**: S10 (idempotent rollups)

### What to build

The permanence layer: a `scheduled` handler in the Worker entry, fired by a daily Cron Trigger, queries the Analytics Engine SQL API for the previous day and upserts into the D1 table `daily_agent_reads` keyed on the full dimension tuple. Idempotent by construction — replaying a day changes nothing. The rollup window covers the last few days on every run, so a failed cron self-heals on the next run without double-counting.

This is the phase where AE's 90-day retention stops being a risk: after each rollup, D1 owns history forever.

Demo: yesterday's synthetic staging events from Phase 1 sit in D1 as aggregate rows; manually re-triggering the rollup yields byte-identical row counts.

### Acceptance criteria

- [ ] `COVERAGE_DB` D1 binding in all three env blocks, distinct database per env; migration creates `daily_agent_reads (date, path, surface, agent, tier, reads)` with a primary key on the dimension tuple; `pnpm cf-typegen` run.
- [ ] Worker entry exports a `scheduled` handler; daily Cron Trigger configured in all env blocks that roll up (staging + production at minimum).
- [ ] Rollup queries the AE SQL API with a Cloudflare API token stored as a Worker secret (pushed via the existing `secrets:staging` / `secrets:production` flow), scoped to Analytics Engine read only.
- [ ] Upsert logic proven idempotent at the module boundary: replaying the same day twice yields identical rows (D1 fixture test); rollup logic lives in a testable module, not inline in the handler.
- [ ] A missed day is recovered by the next scheduled run (window > 1 day) with no double-count — covered by the same idempotence tests.
- [ ] Rollup failures are visible in Worker observability logs (structured error), and a failed run never corrupts previously rolled-up days.
- [ ] Verified end-to-end on staging: synthetic events → next rollup → correct D1 rows; a manual re-trigger produces identical counts.
- [ ] Deployment runbook (`docs/deployment.md`) updated with the new bindings, secrets, and cron.
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green; `pnpm agents:verify` green.

---

## Phase 3: Nightly report artifact

**User stories**: S12 (nightly job fails loudly, never blocks deploys), S2 (report in a format evaluators already know), S5 (dead-content data exists)

### What to build

The exporter and the machine that runs it. The exporter is the site-agnostic module: given `(domain, PageMap, AggregateRow[])` it emits agentcov import entries — `{"cmd": "GET /about (ClaudeBot, verified)", "ranges": ["about.md:1:118"]}` — plus a summary JSON (coverage %, per-page counts, unread list, tier split). Auditmos's PageMap is derived outside the module from the page enumerator plus line counts of the built markdown twins.

Around it, a nightly GitHub Actions workflow: pull D1 aggregates → run the exporter → run pinned `agentcov` (`import` → `html` → `summary` → `unread`) → commit everything to `public/coverage/` → push, which triggers the normal deploy. The workflow is scheduled *after* the daily rollup cron so it always reports on rolled-up data.

Demo: a nightly run commits a real agentcov HTML report generated from production D1 data, and the raw report is reachable as a static asset on the deployed site — before any framing page exists.

### Acceptance criteria

- [ ] Exporter module takes `(domain, PageMap, AggregateRow[])` and returns `{ agentcovImport, summary }`; **no imports from the rest of the codebase** (enforced by the foreign-site fixture and visible in the import graph).
- [ ] Fixture test: a known `(pageMap, aggregates)` pair produces **byte-stable** agentcov import JSON with correct `1:N` ranges and tier-annotated `cmd` strings.
- [ ] **Foreign-site fixture**: a synthetic domain with pages that don't exist in this repo exports correctly — proving no hidden coupling (the Phase 6 pilot must need zero rework).
- [ ] Unread pages appear as zero-read entries — the page map defines the universe, so agentcov's `unread` output is the dead-content report.
- [ ] Auditmos PageMap builder derives `{ url, sourceFile, lineCount }` from the page enumerator + built markdown twins, outside the exporter module; a test asserts every enumerated page appears in the map.
- [ ] CI smoke step runs the **real, pinned** `agentcov` (`uv`, exact version) on the fixture export and asserts a non-empty, parseable `import` + `summary` result — catching upstream format drift at the pin boundary.
- [ ] Nightly workflow: D1 pull (Cloudflare API token scoped to D1 read, stored as a GitHub Actions secret) → exporter via `tsx` → pinned agentcov `import`/`html`/`summary`/`unread` → outputs committed to `public/coverage/` → push triggers the normal deploy.
- [ ] Workflow is scheduled after the daily rollup cron; the ordering is stated in the workflow file.
- [ ] Nightly commits use a commit type semantic-release ignores (`chore(coverage): …`) — no version bumps, no release notes noise.
- [ ] Workflow failure is loud (red run on the repo) but blocks nothing: CI, release, and deploy workflows have no dependency on it; a deliberately-broken dry run proves deploys still pass.
- [ ] After one real nightly run: generated report artifacts exist in `public/coverage/` in git history and are reachable as static assets on staging/production.
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green; `pnpm agents:verify` green.

---

## Phase 4: `/coverage` for humans and agents

**User stories**: S2 (familiar format), S3 (methodology with tiers), S4 (headline % + badge + heatmap), S5 (dead content report), S7 (MCP `get_agent_coverage`), S8 (agent-readable coverage surfaces)

### What to build

The public face of the metric, for both audiences at once. `/coverage` is a prerendered page framing the last committed report: headline "Agent Coverage: N%", the agentcov heatmap (linked/embedded), the dead-content list, the verified/claimed tier split, the "since \<date\>" label, and the **methodology section** (classification rules, tier definitions, granularity honesty, aggregate-only policy). The headline and badge show overall coverage (any tier) with the verified-only figure always displayed alongside — the methodology defines both, so the single badge number is never an unqualified claim.

The nightly job grows a shields-style `badge.svg` (coverage % + color band). The MCP registry grows `get_agent_coverage`, returning the latest committed summary JSON — advertised automatically via `/agents.json` and the server card. The page follows every site convention: md twin, `/llms.txt` entry, `run_worker_first`, nav link, no JS.

Demo: a prospect opens `/coverage` on production and sees a gcov-style report of a website; an MCP client calls `get_agent_coverage` and gets the same numbers.

### Acceptance criteria

- [ ] `/coverage` prerendered, rendering from the last committed report data: headline %, heatmap, dead-content list, tier split (verified vs claimed, never merged), "since \<date\>", methodology section covering classification rules, tier definitions, granularity honesty (file-level `1:N`, no line-level claims for page fetches), and aggregate-only publishing.
- [ ] Headline/badge semantics defined in the methodology: overall % (any tier) as the headline, verified-only % always displayed adjacent on the page and present in the summary JSON.
- [ ] "Agent Coverage" / "dead content report" vocabulary ships in the page copy.
- [ ] `badge.svg` generated by the nightly job into `public/coverage/`, shields-style with a color band; renders correctly when embedded in a README-style context.
- [ ] Page ships zero JavaScript; ≤ 500 lines per source file; legal footer present.
- [ ] `.md` twin + `/llms.txt` entry + nav link + `run_worker_first` entry + slash-free canonical URL; MD-mirror and build-output CI tests green; the page's own visits are captured like any other surface.
- [ ] `get_agent_coverage` added to the MCP tool registry, returning the latest committed summary (headline %, top pages, unread count, tier split) with no runtime D1 access; `/agents.json` and the server card advertise it automatically; standard `/mcp` rate limiting applies.
- [ ] A schema assertion proves every published JSON surface (summary, MCP tool response) is aggregate-only: no IP-shaped, session, or raw-UA fields.
- [ ] New agent surfaces added to `REQUIRED_CHECKS` in the agents-verify script where applicable; `pnpm agents:verify` green including the additions.
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green.

---

## Phase 5: `/observatory` live traffic proof

**User stories**: S1 (live proof agents visit), S8 (agent-readable), S9 re-asserted (the Observatory can never degrade the site)

### What to build

The theater piece: a prerendered `/observatory` shell whose live numbers hydrate from the one new request-time route, `GET /api/observatory` — today's counters and a recent agent-activity feed at aggregate level, read from D1 through the Cache API with a ~60 s TTL so D1 sees a trickle no matter the traffic. The page ships the documented zero-JS exception: ≤ 2 KB of inline vanilla JS, no framework, no island. Without JS the page still stands on its own (last-rollup numbers rendered at build time plus a link to the API).

Demo: a prospect opens `/observatory` and watches agent traffic exist — counters move between cache windows as real crawlers hit the site.

### Acceptance criteria

- [ ] `GET /api/observatory` returns aggregate-only JSON (today's counters + last-N agent events at aggregate level) from D1; schema-asserted: no IP-shaped or raw-UA fields; explicit cache headers; `405` on non-GET.
- [ ] Cache API wrapping verified: a burst of requests inside one TTL window produces a single D1 query (observability logs or a counter prove it).
- [ ] `/observatory` is prerendered; the live-hydration script is ≤ 2 KB, inline, vanilla — the exception and its reason are noted in the page source and the project docs.
- [ ] With JavaScript disabled the page still renders meaningfully: build-time numbers from the last committed report plus a link to `/api/observatory`.
- [ ] `.md` twin + `/llms.txt` entry + nav link + `run_worker_first` entry; MD-mirror and build-output CI tests green.
- [ ] The rendered-route set has grown by exactly this one read-only GET; the static-first exception reference (PRD decision 7) is linked where the route is defined.
- [ ] An API failure or slow D1 read degrades gracefully: the page shows its static state, never an error surface; capture fail-open re-verified end-to-end after the new route ships.
- [ ] Live on production, linked in nav; `pnpm agents:verify` green; `pnpm types && pnpm test && pnpm lint && pnpm knip` green.

---

## Phase 6: Pilot report + production soak

**User stories**: S6 (validated audit deliverable), plus the PRD's end-to-end done definition

### What to build

Two closures. First, the **manual client pilot**: build a PageMap for one friendly external site from a crawl of their pages, derive events from their logs (Worker snippet or Logpush export), run the *unchanged* exporter + agentcov locally, and hand them a private coverage report — the audit deliverable validated with zero productization. Second, the **soak gate**: the full done definition from the PRD, proven on production over time rather than in a single smoke test.

Demo: one external domain's private coverage report, produced by the same pipeline with no code changes; and auditmos.com's own `/coverage` + `/observatory` running on ≥ 7 days of real data with 7 consecutive green nightly runs.

### Acceptance criteria

- [ ] Pilot PageMap built from a crawl of the client's pages; pilot events derived from their real log data; both live outside this repo's site-specific code.
- [ ] The exporter runs on the pilot inputs **without modification** — any needed change is a Phase 3 boundary bug and goes back there first.
- [ ] Private pilot report (heatmap, coverage %, unread list, tier split where derivable from their logs) delivered to the client; contents shared nowhere public.
- [ ] Pilot friction notes captured in the PRD's follow-up section (input for the future productization PRD — not acted on now).
- [ ] End-to-end synthetic check on staging still passes: GPTBot-UA curl, MCP call, and markdown negotiation appear in AE, survive rollup into D1, and appear in the next generated report with correct tiers.
- [ ] Production soak: ≥ 7 days of real data on `/coverage` and `/observatory`, 7 consecutive green nightly report runs, both pages linked in nav and `/llms.txt`.
- [ ] Badge renders on production; `get_agent_coverage` answers over `/mcp` on production.
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green; ≤ 500 lines per file; `pnpm agents:verify` green — no regression to the agent-readiness surface.
- [ ] The queued follow-ups (OSS exporter repo, Trail of Bits upstream recipe, coverage-diff deploy gate, section-level granularity) remain explicitly *not started* — gated on this phase's exit, tracked in the PRD.
