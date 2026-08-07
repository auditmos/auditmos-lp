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

## Production

Cutover from the legacy `auditmos-web` Worker (repo `auditmos/web`) happened
on 2026-08-05 — `auditmos.com` is attached to `auditmos-lp-production`.

```bash
pnpm deploy:production
pnpm secrets:production   # only needed when secret values change
```

Post-deploy checks:

- Pages, `/sitemap.xml`, `/llms.txt`, `robots.txt` respond on auditmos.com.
- Contact form end-to-end (both emails arrive).
- OG card scrape (opengraph.xyz or LinkedIn Post Inspector) picks up `/og.png`.

## Decommission (after a few days of soak)

- Delete the `auditmos-web` Worker; archive the `auditmos/web` repo.
- Optional: `www.auditmos.com` has never had DNS — add a zone redirect rule
  (www → apex) in the dashboard if wanted.

## Agent discovery: DNS-AID records + DNSSEC

**Status (2026-08-07):** records published, zone signed, **one step left** —
publish the DS at the registrar (see step 2). Live endpoints these advertise:

- `https://auditmos.com/mcp` — the MCP agent (Streamable HTTP, read-only, no auth)
- `https://auditmos.com/agents.json` — the DNS-AID organization index

Zone `auditmos.com` = `ad5e7ce03e9251ad90ca97c7f03109b2`. Registrar is **eNom**,
not Cloudflare Registrar, so the DS has to be pasted there by hand.

### Credentials

`wrangler login`'s OAuth session carries `zone (read)` only and cannot write DNS.
These commands need `CLOUDFLARE_API_TOKEN` in `.env` (gitignored) from a token
scoped to `auditmos.com` with **Zone → DNS → Edit**, **Zone → Zone → Read**, and
**Zone → Zone Settings → Edit**.

### 1. The records

Published 2026-08-07, per
[draft-mozleywilliams-dnsop-dnsaid-02](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/).
The `create` calls below are kept for rebuilding the zone from scratch:

```dns
; Organization index (section 3.2) — ServiceMode. TargetName must be
; underscore-free because the index is fetched over TLS with a public cert.
_index._agents.auditmos.com. 3600 IN SVCB 1 auditmos.com. alpn="h2" port="443"

; The MCP agent at its primary owner name (section 3.1) — ServiceMode.
; One agent protocol per record: alpn carries mcp plus the h2 transport.
mcp.auditmos.com.            3600 IN SVCB 1 auditmos.com. alpn="mcp,h2" port="443"

; DNS-SD label for the same agent (section 3.1) — AliasMode (priority 0)
; MUST point at the primary owner rather than repeat its parameters.
_mcp._agents.auditmos.com.   3600 IN SVCB 0 mcp.auditmos.com.
```

SVCB carries host, port, and protocol but no URL path. `/agents.json` closes
that gap: it lists each agent's exact endpoint. The draft's `well-known`
SvcParamKey is not registered yet, so if you want the path in DNS too, add
`key65280="/mcp"` (RFC 9460 private-use range) — drop it if Cloudflare rejects
the unknown key, since nothing depends on it.

```bash
set -a; . ./.env; set +a
ZONE_ID=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=auditmos.com" \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).result[0].id")

create() {
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" --data "$1" \
    | node -pe "const r=JSON.parse(require('fs').readFileSync(0)); r.success ? 'ok '+r.result.name : 'FAILED '+JSON.stringify(r.errors)"
}

create '{"type":"SVCB","name":"_index._agents.auditmos.com","ttl":3600,"data":{"priority":1,"target":"auditmos.com","value":"alpn=\"h2\" port=\"443\""}}'
create '{"type":"SVCB","name":"mcp.auditmos.com","ttl":3600,"data":{"priority":1,"target":"auditmos.com","value":"alpn=\"mcp,h2\" port=\"443\""}}'
create '{"type":"SVCB","name":"_mcp._agents.auditmos.com","ttl":3600,"data":{"priority":0,"target":"mcp.auditmos.com","value":""}}'
```

Verify the way the scanner does — DNS-over-HTTPS, type 64 (SVCB):

```bash
for n in _index._agents.auditmos.com mcp.auditmos.com _mcp._agents.auditmos.com; do
  curl -s -H "accept: application/dns-json" \
    "https://cloudflare-dns.com/dns-query?name=$n&type=SVCB" \
    | node -pe "const j=JSON.parse(require('fs').readFileSync(0)); '$n -> '+(j.Answer?.map(a=>a.data).join(' | ') ?? 'NXDOMAIN')"
done
```

### 2. DNSSEC — order matters, one step outstanding

**A DS record that does not match the zone makes auditmos.com unresolvable for
every validating resolver.** Sign first, publish the DS second, never the
reverse, and do not disable signing while a DS is still published at the parent.

Steps 1 and 2 are **done** — Cloudflare reports `status: pending`, meaning the
zone is signed and serving DNSKEY while it waits for the DS to appear at the
parent. Nothing about resolution changes until step 3.

```bash
# 1. DONE — enable signing. Inert until the DS is published; returns the DS.
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dnssec" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" --data '{"status":"active"}' \
  | node -pe "const r=JSON.parse(require('fs').readFileSync(0)).result; JSON.stringify({ds:r.ds,key_tag:r.key_tag,algorithm:r.algorithm,digest_type:r.digest_type,digest:r.digest},null,2)"

# 2. DONE — zone is serving DNSKEY (2 answers: KSK + ZSK).
curl -s -H "accept: application/dns-json" \
  "https://cloudflare-dns.com/dns-query?name=auditmos.com&type=DNSKEY" \
  | node -pe "'DNSKEY answers: '+(JSON.parse(require('fs').readFileSync(0)).Answer?.length ?? 0)"
```

3. **TODO —** paste the DS below into eNom's DNSSEC / DS record form for
   `auditmos.com`. Re-read it from the API rather than copying it from here if
   the key is ever rotated.

   ```
   auditmos.com. 3600 IN DS 2371 13 2 D107EF222190315ED73B44C9E4EAD1061218389A0FBFFC04EA220762A791F352
   ```

   | Field | Value |
   | --- | --- |
   | Key tag | `2371` |
   | Algorithm | `13` (ECDSA P-256 SHA-256) |
   | Digest type | `2` (SHA-256) |
   | Digest | `D107EF222190315ED73B44C9E4EAD1061218389A0FBFFC04EA220762A791F352` |

4. Wait for the parent to publish, then confirm the chain validates:

```bash
curl -s -H "accept: application/dns-json" \
  "https://cloudflare-dns.com/dns-query?name=auditmos.com&type=DS" \
  | node -pe "const j=JSON.parse(require('fs').readFileSync(0)); 'AD='+j.AD+' DS='+(j.Answer?.length ?? 0)"
```

`AD=true` with a DS answer means validating resolvers now authenticate the
DNS-AID records, which is what the DNS-AID draft asks for (section 1.1).

### Verifying the whole thing

```bash
curl -s -X POST https://isitagentready.com/api/scan \
  -H 'Content-Type: application/json' -d '{"url":"https://auditmos.com"}' \
  | node -pe "JSON.stringify(JSON.parse(require('fs').readFileSync(0)).checks.discoverability, null, 2)"
```

As of 2026-08-07 this returns `robotsTxt`, `sitemap`, and `linkHeaders` passing.
`dnsAid` reports all three records found and structurally valid
(`serviceRecordCount: 2`, `aliasRecordCount: 1`, `validationIssues: []`) but
fails on one thing only:

> DNS for AI Discovery (DNS-AID) records found, but DNSSEC was not validated

That is step 3 above — the DS at eNom — and nothing else.
