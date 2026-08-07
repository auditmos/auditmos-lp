# PRD — Agent readiness 100/100

**Status:** Draft · **Owner:** Tomasz Kowalczyk · **Drafted:** 2026-08-07
**Discovery:** ask-skill interview 2026-08-07 + memory `agent-readiness-100-goal`
**Issues:** PRD [#11](https://github.com/auditmos/auditmos-lp/issues/11) · Phases [#12–#18](https://github.com/auditmos/auditmos-lp/issues) · Plan: [`plans/agent-readiness-100.md`](../plans/agent-readiness-100.md)
**Sequencing:** ships and is verified **before** [`prd-agent-coverage.md`](./prd-agent-coverage.md) starts.

## Problem Statement

auditmos.com scores **53/100 (Level 4 "Agent-Integrated")** on Cloudflare's agent-readiness scanner, [isitagentready.com](https://isitagentready.com) (measured 2026-08-07). The site already ships a strong agent surface — llms.txt, markdown negotiation, MCP server + server card, DNS-AID, Content Signals — but every one of the 7 failing checks sits in the scanner's **API / Auth / MCP** category, which the current architecture simply never implemented.

For a company about to pitch agent-readiness as a service, a 53 is a contradiction in a screenshot. The direct competitor in this niche (turva.dev, a solo Finnish consultant selling agent-readiness audits) scores 100/100 Level 5 and uses that score as its hero proof. 100/100 is not the differentiator — it is the **floor of credibility**, and the prerequisite for the Agent Coverage showcase (separate PRD) which assumes "of course we score 100; that's the boring part."

### Verified scanner facts (reverse-engineered 2026-08-07, do not re-derive)

- Score = `passing / non-neutral checks` across four categories (Discoverability, Content Accessibility, Bot Access Control, API/Auth/MCP). **Commerce checks are `countInScore: false`** — informational only, not needed for 100.
- `botAccessControl.webBotAuth` reports **neutral** and is excluded from the denominator (it is a bot-operator surface a website cannot pass).
- Scanner API: `POST https://isitagentready.com/api/scan {"url": ...}` — already consumed by `pnpm agents:verify`. Each check's evidence lists the exact URLs probed.
- Current state: 8 of 15 counted checks pass. The 7 failures and their probe targets:

| Check | Scanner probes |
|---|---|
| `discovery.apiCatalog` | `/.well-known/api-catalog` (RFC 9727 linkset) |
| `discovery.oauthDiscovery` | `/.well-known/openid-configuration`, then `/.well-known/oauth-authorization-server` (RFC 8414) |
| `discovery.oauthProtectedResource` | `/.well-known/oauth-protected-resource` (RFC 9728) |
| `discovery.authMd` | `/auth.md` (parses identity types) |
| `discovery.a2aAgentCard` | `/.well-known/agent-card.json` (parses name + version) |
| `discovery.agentSkills` | `/.well-known/agent-skills/index.json`, fallback `/.well-known/skills/index.json` |
| `discovery.webMcp` | Loads the homepage and detects tools registered via `navigator.modelContext` ("imperative_api") |

## Solution

Ship the seven missing surfaces — six of them prerendered documents, one an inline homepage script — plus a **real, minimal OAuth flow** (interview decision Q1): a `client_credentials` token endpoint whose tokens genuinely do something — **authenticated agents get a higher `/mcp` rate limit**. That single decision makes the whole auth cluster honest without disclaimers:

- The authorization-server metadata describes a server that actually issues tokens.
- The protected-resource metadata (`resource: https://auditmos.com/mcp`) is true per the MCP spec — `/mcp` becomes an optionally-authenticated resource.
- `/auth.md` documents a real capability ("register, get a token, get 5× the rate limit"), not a legal fiction.

Every other surface follows the repo's established honesty principle: **derived from what the site actually ships, so it cannot overclaim** (the same rule `agents.json` already obeys — its tool list is derived from the MCP registry).

Success looks like: `isitagentready.com/auditmos.com` renders **100/100**, `pnpm agents:verify` enforces all 15 checks as `REQUIRED_CHECKS`, and an MCP client that registers via OAuth measurably receives the higher rate limit.

## User Stories

### AI agent — OAuth-aware MCP client

1. As an MCP client hitting `/mcp` heavily, I want to discover via `/.well-known/oauth-protected-resource` that an authorization server exists, so that I can obtain a token instead of being throttled at the anonymous limit.
2. As an OAuth-capable agent, I want `POST /oauth/register` to give me a `client_id` + `client_secret` without human interaction, so that registration doesn't dead-end on a form I can't fill.
3. As a token-bearing agent, I want `/mcp` requests with my Bearer token to be rate limited at the authenticated tier, so that the token was worth acquiring.
4. As an agent presenting an invalid or expired token, I want a `401` with a `WWW-Authenticate` header pointing at the protected-resource metadata, so that I can recover by re-registering instead of guessing.

### AI agent — discovery consumer

5. As an agent landing on any response, I want `Link` headers and `/.well-known/api-catalog` to enumerate every machine-readable surface, so that I discover capabilities from one fetch.
6. As an A2A-ecosystem agent, I want `/.well-known/agent-card.json` to describe what I can do here (read-only HTTP+JSON over public data) and what I cannot (no writes, no streaming), so that I don't attempt unsupported operations.
7. As a coding agent, I want `/.well-known/agent-skills/index.json` with fetchable `SKILL.md` files and matching sha256 digests, so that I can install site-specific skills and verify their integrity.
8. As a browser-embedded agent, I want `navigator.modelContext` tools registered on page load, so that I can call site capabilities without leaving the page.
9. As any agent reading `/auth.md`, I want the true auth model in one markdown page — what's public, what a token buys, how to register and revoke — so that I never have to infer policy from probing.

### Scanner / prospect

10. As the isitagentready.com scanner, I want every probe target answering with valid content, so that the site scores 100/100.
11. As a prospect evaluating Auditmos's agent-readiness claims, I want the public score to be perfect, so that the pitch is self-evidencing.

### Maintainer

12. As the site maintainer, I want all seven new check ids added to `REQUIRED_CHECKS` in `scripts/agents-verify-lib.ts`, so that any regression fails `pnpm agents:verify` after every deploy.
13. As the site maintainer, I want the discovery surfaces (api-catalog, agent card, skills index, auth.md, Link headers) generated from one surface registry, so that adding or renaming a surface cannot leave the others stale.
14. As the site maintainer, I want both rate-limit tiers declared in one constants module and asserted by tests against everything that advertises them (`initialize`, `/agents.json`, `/auth.md`), so that the site never states two different limits.

## Implementation Decisions

### Architecture spine

1. **Surface registry** — `src/agents/surfaces.ts`, the single source of truth enumerating every machine-readable surface (URL, media type, title, RFC 8288 relation). Consumed by the API catalog, the A2A agent card, `auth.md` cross-links, and `agentDiscoveryHeaders()`. Same philosophy as the MD-mirror's page enumerator: one list, many projections, drift impossible by construction.

2. **API catalog** — `src/pages/.well-known/api-catalog.ts`, prerendered RFC 9727 linkset (`application/linkset+json`) projecting the surface registry: `service-desc` (llms.txt, agents.json), `service-doc` (auth.md, markdown twins), `service-meta` (ai-catalog, MCP server card, agent card, skills index, OAuth metadata). Media type restated in `_headers` (prerendered `Response` headers do not survive the build — the server-card lesson).

3. **OAuth module** — `src/oauth/`, a deep module hiding all token mechanics behind two request-time routes and three static documents:
   - `POST /oauth/register` — RFC 7591 dynamic client registration, open and unauthenticated. **Stateless client credentials:** `client_secret = HMAC(OAUTH_SIGNING_KEY, client_id)` — verification needs no storage, no KV, no D1. Returns `client_id`, `client_secret`, and the token endpoint URL.
   - `POST /oauth/token` — `client_credentials` grant only. Verifies the stateless secret, issues a short-lived (1 h) HMAC-signed compact token (JWT, `HS256`, `OAUTH_SIGNING_KEY`). Scope: `read:site`. Explicit `400/401` JSON errors per RFC 6749.
   - `/.well-known/oauth-authorization-server` + `/.well-known/openid-configuration` (identical document, second path because the scanner probes it first) — RFC 8414 metadata generated at build from `site.url`: issuer, both endpoint URLs, `grant_types_supported: ["client_credentials"]`, `scopes_supported`, `registration_endpoint`, `service_documentation: /auth.md`.
   - `/.well-known/oauth-protected-resource` — RFC 9728: `resource: <site>/mcp`, `authorization_servers: [<site>]`, `bearer_methods_supported: ["header"]`, `resource_documentation: /auth.md`.
   - New Wrangler secret **`OAUTH_SIGNING_KEY`** per env (`.dev.vars*`, `pnpm secrets:*`).

   **Why these are request-time routes (static-first exception, documented here per project convention):** token issuance is a cryptographic exchange over POST bodies; a prerendered asset cannot perform it. They join `/api/contact` and `/mcp` as the only rendered routes.

4. **Tiered MCP rate limit** — second Workers binding `MCP_RATE_LIMITER_AUTH` (600 req / 60 s; the binding's `period` accepts only 10 or 60) alongside the existing anonymous 120/60. `src/mcp/server.ts` gains `MCP_RATE_LIMIT_AUTH` next to `MCP_RATE_LIMIT` — the constants remain the single source advertised by `initialize`, `/agents.json`, and now `/auth.md`. `/mcp` request handling: valid Bearer token → authenticated limiter; no token → anonymous limiter; **present-but-invalid token → `401` + `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"`** (RFC 9728 §5), never silently downgraded to anonymous. Binding must be repeated in all three env blocks (bindings are not inherited) and `pnpm cf-typegen` re-run.

5. **A2A agent card** — `src/agents/agent-card.ts` + `src/pages/.well-known/agent-card.json.ts`, A2A v0.3 shape: `protocolVersion`, name, description (read-only public company data; no writes; contact form stays human-only), `preferredTransport: "HTTP+JSON"`, `url: <site>`, provider block from `src/brand/site.ts`, `skills` **derived from the MCP tool registry** so the card cannot overclaim. No A2A JSON-RPC endpoint in v1 — the card honestly describes the existing HTTP+JSON surface (the scanner parses name + version only; a real A2A endpoint is future work, not a fiction to fake now).

6. **Agent skills** — `src/pages/.well-known/agent-skills/index.json.ts` + one directory per skill serving `SKILL.md`. Three launch skills, each grounded in an existing surface: `company-info` (entity, footprint, verification links), `services` (three service lines, engagement shape), `read-this-site` (how to consume llms.txt, markdown twins, `/mcp`, OAuth registration). Index follows the `schemas.agentskills.io/discovery/0.2.0` shape; **sha256 digests computed at build from the served SKILL.md bytes** — a stale digest is a build failure, not a runtime surprise.

7. **auth.md** — `src/pages/auth.md.ts`, `text/markdown`. Sections: what is public (everything readable), what a credential buys (the authenticated `/mcp` tier — with both numbers), how to register (`/oauth/register` walkthrough), identity types (anonymous, `client_credentials`), revocation + contact, links into the surface registry. This is a *narrative twin* of the OAuth metadata; a test asserts the endpoints and limits it names match the constants.

8. **WebMCP** — inline `<script>` in the base layout: feature-detect `navigator.modelContext?.provideContext`, register three read-only tools mirroring MCP tools (`get_company`, `get_services`, `get_contact_channels`), each `execute` fetching an existing markdown twin or returning `src/brand/site.ts` facts. Constraints: ≤ 2 KB, vanilla, wrapped in try/catch, **a no-op in every normal browser** — the zero-JS principle holds because no JS executes beyond the feature check.

9. **Discovery headers** — extend `agentDiscoveryHeaders()` with the new relations from the surface registry and the `_headers` media-type entries for `api-catalog` (`application/linkset+json`) and the OAuth metadata documents (`application/json`).

10. **Verification guard** — the seven check ids join `REQUIRED_CHECKS` with their `backedBy` pointers. `pnpm agents:verify` after deploy is the regression gate, exactly as designed.

### System boundaries

- **Build time:** surface registry projection into api-catalog / agent card / skills digests / auth.md / `_headers`; OAuth metadata baked from `site.url` per env.
- **Request time (Worker):** `/oauth/register` and `/oauth/token` join `/api/contact` and `/mcp` as the only rendered routes. `/mcp` adds token verification (pure function, no external calls).
- **Browser:** the WebMCP script is inert everywhere except agent-embedded browsers exposing `navigator.modelContext`.

### Routes added

| Path | Type | Purpose |
|---|---|---|
| `/.well-known/api-catalog` | Prerendered | RFC 9727 linkset |
| `/.well-known/oauth-authorization-server` | Prerendered | RFC 8414 metadata |
| `/.well-known/openid-configuration` | Prerendered | Same document, scanner's first probe |
| `/.well-known/oauth-protected-resource` | Prerendered | RFC 9728, resource = `/mcp` |
| `/.well-known/agent-card.json` | Prerendered | A2A v0.3 card |
| `/.well-known/agent-skills/index.json` | Prerendered | Skills discovery index |
| `/.well-known/agent-skills/<name>/SKILL.md` | Prerendered | One per skill (×3) |
| `/auth.md` | Prerendered | Narrative auth documentation |
| `/oauth/register` | Worker (POST) | RFC 7591 dynamic client registration |
| `/oauth/token` | Worker (POST) | `client_credentials` token issuance |

None of these are HTML pages: no `run_worker_first` additions, no MD-mirror twins, no llms.txt entries required (though `auth.md` may be linked from llms.txt as documentation).

## Validation Strategy

### OAuth module (component 3, 4)

Vitest at the module boundary (handlers extracted per repo convention). Done when:

- `POST /oauth/register` → `201` with `client_id`, `client_secret`; the secret verifies against the stateless HMAC scheme.
- `POST /oauth/token` with valid credentials → `200` with `access_token`, `token_type: "Bearer"`, `expires_in`; the token validates.
- Wrong secret → `401 invalid_client`; unsupported grant → `400 unsupported_grant_type`; malformed body → `400` (Zod at the boundary).
- Expired or garbage Bearer on `/mcp` → `401` with `WWW-Authenticate` naming the PRM URL. No silent anonymous fallback.
- Valid Bearer on `/mcp` → routed to `MCP_RATE_LIMITER_AUTH` (limiter injected/mocked in tests).
- No storage is touched anywhere in the module (stateless by construction).

### Surface coherence (components 1, 2, 5, 6, 7, 9)

Build-output tests, extending `src/site/build-output.test.ts` patterns. Done when:

- Every URL the api-catalog, agent card, skills index, and auth.md reference exists in the build output (no dead self-references).
- Skills digests recomputed from the built `SKILL.md` files match the served index.
- Agent card `skills` ⊆ MCP tool registry; card identity matches `MCP_SERVER_INFO`.
- The rate limits stated in `auth.md`, `initialize`, and `/agents.json` all equal the two constants.
- `_headers` carries the correct media types for the extensionless well-known documents.
- OAuth metadata document at both paths is byte-identical (server-card precedent).

### Scanner end-to-end

- Staging deploy → `pnpm agents:verify https://staging.auditmos.com` reports the seven checks as `NEW PASS` → ids move into `REQUIRED_CHECKS` → verify again: `OK`, with `dnsAid` skipped as apex-only.
- Production deploy → `pnpm agents:verify` green on all 15 → `isitagentready.com/auditmos.com` renders **100/100**.

### Done definition

- All 15 `REQUIRED_CHECKS` pass on production; scanner UI shows 100/100.
- Manual end-to-end: register → token → authenticated `/mcp` calls sustain > 120 req/min without 429 (sequential, per the limiter's eventual-consistency note in CLAUDE.md).
- `pnpm types && pnpm test && pnpm lint && pnpm knip` green; ≤ 500 lines per source file.
- `OAUTH_SIGNING_KEY` present in all three envs via `pnpm secrets:*`.

## Out of Scope

- **Commerce surfaces / Level 5 "Agent-Native"** (x402, UCP, ACP, MPP, AP2) — score-neutral by scanner design; deliberately deferred to a future PRD where pricing/productization decisions can make them honest.
- **Web Bot Auth** — a bot-operator surface; the check stays neutral regardless.
- **A real A2A JSON-RPC endpoint** — the card describes the existing HTTP+JSON surface; a live A2A server is future work.
- **`authorization_code` flow, user accounts, consent screens** — no human-login surface exists or is wanted.
- **WebMCP write actions** — read-only tools only; the contact form stays Turnstile-gated and human-only.
- **Publishing token analytics** — belongs to the Agent Coverage PRD.

## Further Notes

- **Binding drift caveat (existing, now doubled):** nothing can catch a rate-limiter binding drifting from its constant; after editing `wrangler.jsonc`, verify both limiter bindings survive into `dist/server/wrangler.json` and run `pnpm cf-typegen`. The binding must be repeated in `dev`, `staging`, `production` blocks.
- **Deploy propagation:** scanner re-runs within a couple of minutes of deploy can show stale results — re-run `agents:verify` before treating a failure as real (existing guidance).
- **Competitor reference:** turva.dev's implementations (source: `github.com/erekola/turva-worker`) were used as a passing reference during discovery; this PRD's OAuth is deliberately *more* real than theirs (they disclaim "discovery, not protection"; we issue working tokens).
- **Memory references:** `agent-readiness-100-goal` (scanner facts, scoring formula), `auditmos-rebuild-discovery`, `auditmos-entity`.
