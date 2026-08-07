# Plan: Agent readiness 100/100

> Source PRD: `docs/prd-agent-readiness-100.md`

## Architectural decisions

Durable decisions that apply across all phases. These should not change as later phases are built; if a phase needs to revisit one, raise it before proceeding.

- **Static-first preserved**: Every new discovery surface is a prerendered document. Exactly two new request-time routes exist — `POST /oauth/register` and `POST /oauth/token` — joining `/api/contact` and `/mcp` as the only rendered routes. The exception is documented in the PRD (token issuance is a cryptographic exchange over POST bodies; a prerendered asset cannot perform it). No new HTML pages: no `run_worker_first` additions, no MD-mirror twins, no mandatory `/llms.txt` entries (`/auth.md` may be linked from llms.txt as documentation).
- **Surface registry as single source of truth**: `src/agents/surfaces.ts` enumerates every machine-readable surface (URL, media type, title, RFC 8288 relation). The API catalog, agent card, `auth.md` cross-links, and `agentDiscoveryHeaders()` are all projections of this one list — same philosophy as the MD-mirror's page enumerator: one list, many projections, drift impossible by construction. Each later phase *adds its surface to the registry*; the catalog and Link headers update automatically.
- **Auth model**: Real, minimal OAuth — `client_credentials` grant only. Stateless client credentials: `client_secret = HMAC(OAUTH_SIGNING_KEY, client_id)`, so verification needs no storage (no KV, no D1, nothing persisted anywhere). Access tokens are short-lived (1 h) HMAC-signed compact JWTs (`HS256`, `OAUTH_SIGNING_KEY`), scope `read:site`. One new Wrangler secret, `OAUTH_SIGNING_KEY`, distinct per env, distributed via `.dev.vars*` + `pnpm secrets:*`. No `authorization_code`, no user accounts, no consent screens.
- **What a token buys**: A higher `/mcp` rate limit. Anonymous tier stays 120 req/60 s (`MCP_RATE_LIMITER`); authenticated tier is 600 req/60 s via a second binding `MCP_RATE_LIMITER_AUTH` (binding `period` accepts only 10 or 60). The two constants live in `src/mcp/server.ts` and remain the single source advertised by `initialize`, `/agents.json`, and `/auth.md`. Bindings are not inherited — both must be repeated in all three env blocks, `pnpm cf-typegen` re-run after edits, and nothing automated can catch a binding drifting from its constant (verify by hand in `dist/server/wrangler.json`).
- **401 semantics**: A present-but-invalid or expired Bearer token on `/mcp` returns `401` with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"` (RFC 9728 §5). Never silently downgraded to the anonymous tier. No token at all → anonymous tier, as today.
- **Honesty principle**: Every surface is derived from what the site actually ships, so it cannot overclaim — agent-card skills derive from the MCP tool registry, skills digests are computed at build from the served bytes, the catalog projects the registry. Nothing describes a capability that does not exist (no fake A2A endpoint, no fictional commerce surfaces).
- **Verification spine**: `pnpm agents:verify <url>` after every deploy is the regression gate. Each phase deploys to staging, sees its check ids appear as `NEW PASS`, moves them into `REQUIRED_CHECKS` in `scripts/agents-verify-lib.ts` with a `backedBy` pointer, and re-verifies to `OK` (with `dnsAid` skipped as apex-only on staging). Final state: 15 required checks.
- **Staging is the phase gate; production changes once**: Phases 1–6 verify on `staging.auditmos.com` only. Production deploys once, in Phase 7 — the public score jumps from 53 to 100 in a single cutover instead of crawling through intermediate states, and the Phase 2→3 window (tokens issued but not yet worth anything) never exists on production.
- **Media types survive via `_headers`**: Prerendered `Response` headers do not survive the build (the server-card lesson). Every extensionless well-known document restates its media type in the generated `_headers` file via the `agentDiscoveryHeaders()` integration — never hand-written in `public/_headers`.
- **Sequencing**: This plan ships and is verified **before** any `prd-agent-coverage.md` work starts.

Scanner facts (verified 2026-08-07, do not re-derive): score = passing / non-neutral checks; commerce checks are score-neutral; `webBotAuth` is neutral; current state 8/15 counted checks pass. The seven check ids to win: `discovery.apiCatalog`, `discovery.oauthDiscovery`, `discovery.oauthProtectedResource`, `discovery.authMd`, `discovery.a2aAgentCard`, `discovery.agentSkills`, `discovery.webMcp`.

---

## Phase 1: Surface registry + API catalog

**User stories**: U5, U13, U12 (first increment)

### What to build

The first tracer bullet through the whole architecture spine: the surface registry (`src/agents/surfaces.ts`) listing every machine-readable surface the site ships *today* (llms.txt, agents.json, ai-catalog, MCP server card, sitemap, markdown twins), plus its first projection — `/.well-known/api-catalog`, a prerendered RFC 9727 linkset (`application/linkset+json`) grouping surfaces as `service-desc` / `service-doc` / `service-meta`. `agentDiscoveryHeaders()` extends to emit the registry's relations as `Link` headers and the catalog's media type into `_headers`.

This phase is deliberately thin: it proves the registry→projection→headers→build-test→scanner→`REQUIRED_CHECKS` loop end-to-end before the riskier OAuth work rides on it. Every later phase reuses this loop unchanged.

### Acceptance criteria

- [ ] Surface registry module exists with one entry per currently-shipped machine-readable surface (URL, media type, title, RFC 8288 relation); typed, exported as the module's only interface.
- [ ] `/.well-known/api-catalog` is prerendered, valid RFC 9727 linkset JSON, and every linked URL is a projection of the registry — no hand-maintained URL list.
- [ ] `_headers` carries `application/linkset+json` for `/.well-known/api-catalog`, appended by the `agentDiscoveryHeaders()` integration (which stays *after* the adapter in `integrations`).
- [ ] `Link` response headers advertise the catalog with an appropriate relation.
- [ ] Build-output test: every URL the catalog references exists in the build output (no dead self-references). Extends the existing `src/site/build-output.test.ts` patterns.
- [ ] Staging deploy → `pnpm agents:verify https://staging.auditmos.com` reports `discovery.apiCatalog` as `NEW PASS` → id added to `REQUIRED_CHECKS` with its `backedBy` pointer → verify again reports `OK` (`dnsAid` skipped as apex-only).
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green.

---

## Phase 2: OAuth issuance — registration, tokens, metadata

**User stories**: U1 (discovery half), U2, U12

### What to build

The `src/oauth/` deep module and its two request-time routes: `POST /oauth/register` (RFC 7591 dynamic client registration, open and unauthenticated — returns `client_id`, the stateless HMAC-derived `client_secret`, and the token endpoint URL) and `POST /oauth/token` (`client_credentials` grant only — verifies the stateless secret, issues the 1 h `HS256` JWT with scope `read:site`, explicit `400`/`401` JSON errors per RFC 6749, Zod at the boundary). Handlers extracted into the module per repo convention so tests hit the module boundary, not the Astro page wrapper.

Plus the three prerendered metadata documents, all registered in the surface registry: `/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration` (byte-identical RFC 8414 document — the scanner probes the openid path first) generated at build from `site.url` (issuer, both endpoint URLs, `grant_types_supported: ["client_credentials"]`, `scopes_supported`, `registration_endpoint`, `service_documentation: /auth.md`), and `/.well-known/oauth-protected-resource` (RFC 9728: `resource: <site>/mcp`, `authorization_servers: [<site>]`, `bearer_methods_supported: ["header"]`, `resource_documentation: /auth.md`).

Until Phase 3 lands, tokens verify but confer no benefit — an acceptable intermediate state that exists only on staging (see architectural decisions).

### Acceptance criteria

- [ ] `POST /oauth/register` → `201` with `client_id`, `client_secret`, token endpoint URL; the secret verifies against the stateless HMAC scheme; no storage touched anywhere in the module (stateless by construction).
- [ ] `POST /oauth/token` with valid credentials → `200` with `access_token`, `token_type: "Bearer"`, `expires_in`; the issued token validates.
- [ ] Wrong secret → `401 invalid_client`; unsupported grant → `400 unsupported_grant_type`; malformed body → `400` (Zod at the boundary). All error bodies are RFC 6749-shaped JSON with explicit status.
- [ ] `OAUTH_SIGNING_KEY` (cryptographically random, distinct per env) present in `.dev.vars`, `.dev.vars.staging`, `.dev.vars.production` and pushed via `pnpm secrets:staging` / `pnpm secrets:production`.
- [ ] The two authorization-server metadata paths serve a byte-identical document (asserted by a build-output test — the server-card precedent); the protected-resource document names `/mcp` as the resource.
- [ ] All three metadata documents are in the surface registry — the api-catalog and `Link` headers pick them up with no catalog edits; `_headers` carries `application/json` for the extensionless paths.
- [ ] Vitest covers the module boundary per the PRD validation strategy (register, token, each error class, statelessness).
- [ ] Manual staging round-trip: `curl` register → token → decode-and-inspect succeeds against `staging.auditmos.com`.
- [ ] Staging deploy → `discovery.oauthDiscovery` and `discovery.oauthProtectedResource` report `NEW PASS` → both ids added to `REQUIRED_CHECKS` → verify again `OK`.
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green.

---

## Phase 3: Authenticated `/mcp` tier + auth.md

**User stories**: U1, U3, U4, U9, U14, U12

### What to build

Make the token worth acquiring, then document it. The second rate-limiter binding `MCP_RATE_LIMITER_AUTH` (600 req/60 s) lands in `wrangler.jsonc` — repeated in `dev`, `staging`, and `production` blocks — with `MCP_RATE_LIMIT_AUTH` added next to `MCP_RATE_LIMIT` in `src/mcp/server.ts`. `/mcp` request handling gains token verification (pure function, no external calls): valid Bearer → authenticated limiter; no token → anonymous limiter; present-but-invalid → `401` + `WWW-Authenticate` naming the protected-resource metadata URL, never a silent downgrade. `initialize` and `/agents.json` advertise both tiers.

`/auth.md` (`text/markdown`) is the narrative twin of the OAuth metadata, shipped in this phase because its central claim — what a credential buys, with both numbers — only becomes true here. Sections: what is public (everything readable), what a credential buys (both tiers, both numbers), how to register (walkthrough of the Phase 2 endpoints), identity types (anonymous, `client_credentials`), revocation + contact, links into the surface registry. Registered in the surface registry.

### Acceptance criteria

- [ ] `MCP_RATE_LIMITER_AUTH` binding present in all env blocks; `pnpm cf-typegen` run; both limiter bindings verified by hand in `dist/server/wrangler.json` after build (nothing automated can catch binding-vs-constant drift).
- [ ] Valid Bearer on `/mcp` → routed to the authenticated limiter (limiter injected/mocked in tests); no token → anonymous limiter, unchanged behavior.
- [ ] Expired or garbage Bearer on `/mcp` → `401` with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"`. A test asserts there is no silent anonymous fallback.
- [ ] A single test asserts the rate limits stated in `/auth.md`, `initialize`, and `/agents.json` all equal the two constants — the site can never state two different limits.
- [ ] `/auth.md` serves `text/markdown`, contains all six sections, and every endpoint URL it names resolves in the build output (build-output test).
- [ ] Manual staging demo: register → token → sustained *sequential* authenticated calls exceed 120 req/min without a 429 (sequential, per the limiter's eventual-consistency note in CLAUDE.md — a parallel burst proves nothing).
- [ ] Staging deploy → `discovery.authMd` reports `NEW PASS` → id added to `REQUIRED_CHECKS` → verify again `OK`.
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green.

---

## Phase 4: A2A agent card

**User stories**: U6, U12

### What to build

`/.well-known/agent-card.json`, a prerendered A2A v0.3 card: `protocolVersion`, name, version, description honestly stating the boundary (read-only HTTP+JSON over public company data; no writes, no streaming; the contact form stays human-only), `preferredTransport: "HTTP+JSON"`, `url: <site>`, provider block from `src/brand/site.ts`, and `skills` **derived from the MCP tool registry** so the card cannot overclaim. No A2A JSON-RPC endpoint in v1 — the card describes the existing HTTP+JSON surface (the scanner parses name + version only; a live A2A server is future work, not a fiction to fake now). Registered in the surface registry.

### Acceptance criteria

- [ ] Card is prerendered, valid A2A v0.3 shape, with name + version present (the scanner's parse targets).
- [ ] Card `skills` ⊆ MCP tool registry and card identity matches `MCP_SERVER_INFO` — both asserted by build-output tests, not by convention.
- [ ] Description states the read-only/no-writes/no-streaming boundary and that contact is human-only.
- [ ] Card is in the surface registry — api-catalog and `Link` headers updated with no catalog edits.
- [ ] Staging deploy → `discovery.a2aAgentCard` reports `NEW PASS` → id added to `REQUIRED_CHECKS` → verify again `OK`.
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green.

---

## Phase 5: Agent skills

**User stories**: U7, U12

### What to build

`/.well-known/agent-skills/index.json` (the `schemas.agentskills.io/discovery/0.2.0` shape) plus one directory per skill serving its `SKILL.md`. Three launch skills, each grounded in an existing surface so nothing overclaims: `company-info` (entity, footprint, verification links), `services` (three service lines, engagement shape), `read-this-site` (how to consume llms.txt, markdown twins, `/mcp`, OAuth registration). The index's **sha256 digests are computed at build from the served `SKILL.md` bytes** — a stale digest is a build failure, not a runtime surprise. Index registered in the surface registry.

### Acceptance criteria

- [ ] `/.well-known/agent-skills/index.json` prerendered and valid against the discovery 0.2.0 shape; all three `SKILL.md` files fetchable at the URLs the index states.
- [ ] Digests in the served index match sha256 recomputed from the built `SKILL.md` files — asserted by a build-output test; editing a `SKILL.md` without the digest following fails the build, never ships stale.
- [ ] `read-this-site` accurately walks the surfaces that exist as of this phase, including OAuth registration.
- [ ] Index is in the surface registry — api-catalog and `Link` headers updated with no catalog edits.
- [ ] Staging deploy → `discovery.agentSkills` reports `NEW PASS` → id added to `REQUIRED_CHECKS` → verify again `OK`.
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green.

---

## Phase 6: WebMCP homepage tools

**User stories**: U8, U12

### What to build

An inline `<script>` in the base layout that feature-detects `navigator.modelContext?.provideContext` and, only when present, registers three read-only tools mirroring MCP tools — `get_company`, `get_services`, `get_contact_channels` — each `execute` fetching an existing markdown twin or returning `src/brand/site.ts` facts. Constraints: ≤ 2 KB, vanilla JS, wrapped in try/catch, **a no-op in every normal browser** — the zero-JS principle holds because nothing executes beyond the feature check.

### Acceptance criteria

- [ ] Built homepage HTML contains the inline script; it is ≤ 2 KB, has no external dependencies, and its whole body is guarded by the feature check inside try/catch (asserted by a build-output test on the emitted HTML).
- [ ] In a normal browser the page's behavior is byte-for-byte unchanged: no network requests, no console errors, renders identically with JavaScript disabled.
- [ ] The three registered tools mirror existing MCP tools/data only — no capability exists here that the MCP server does not also expose.
- [ ] Staging deploy → `discovery.webMcp` reports `NEW PASS` (scanner loads the homepage and detects the `imperative_api` registration) → id added to `REQUIRED_CHECKS` → verify again `OK`.
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green.

---

## Phase 7: Production rollout — 100/100

**User stories**: U10, U11, U12 (complete), plus the PRD's done definition

### What to build

No new surfaces — the operational sequence that takes everything from phases 1–6 to production in one cutover and proves the PRD's done definition against the real host, real secrets, and the real scanner UI. This is where `dnsAid` stops being skipped (production is the apex) and all 15 `REQUIRED_CHECKS` are enforced for good.

### Acceptance criteria

- [ ] `OAUTH_SIGNING_KEY` confirmed present in the production env (distinct from staging's key) via `pnpm secrets:production`; all pre-existing secrets untouched.
- [ ] `pnpm deploy:production` succeeds; both rate-limiter bindings confirmed in the deployed config.
- [ ] `pnpm agents:verify` (production default) reports all 15 `REQUIRED_CHECKS` passing, `dnsAid` included as apex. If a check fails within minutes of deploy, re-run before treating it as real — scanner results can lag deploys (PRD propagation note).
- [ ] `isitagentready.com/auditmos.com` UI renders **100/100** (level name as reported by the scanner — Level 5 "Agent-Native" additionally requires the out-of-scope commerce surfaces, so Level 4 at 100/100 is the expected end state of this plan).
- [ ] Manual production end-to-end: register → token → sustained sequential authenticated `/mcp` calls exceed 120 req/min without 429; an invalid token gets `401` + `WWW-Authenticate` naming the production protected-resource URL.
- [ ] `pnpm types && pnpm test && pnpm lint && pnpm knip` green; every source file ≤ 500 lines.
- [ ] A screenshot-worthy state: the score the sales pitch depends on is live, and any future regression fails `pnpm agents:verify` after deploy. The agent-coverage PRD is now unblocked.
