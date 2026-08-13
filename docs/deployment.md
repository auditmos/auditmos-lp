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

1. **Zone TLS** (Cloudflare dashboard → SSL/TLS, zone `auditmos.com`):
   encryption mode **Full** or **Full (strict)**, and **Edge Certificates →
   Always Use HTTPS → on**. Without the toggle, `http://auditmos.com/` answers
   `200` in the clear and no HSTS policy downstream is worth anything (#26).
   Use that toggle, **never** the "Redirect from HTTP to HTTPS" redirect rule —
   the rule runs ahead of Workers and 301-loops on a Worker custom domain, and
   Flexible mode plus any HTTPS redirect loops as well. Enabled 2026-08-13; a
   zone rebuild must restore both.

   Same panel: **Minimum TLS Version → TLS 1.2**, set 2026-08-13 (#28). This
   drops TLS 1.0 and 1.1, and with them `TLS_RSA_WITH_3DES_EDE_CBC_SHA` — 3DES
   is offered only under TLS 1.0 here, so no separate cipher setting is needed.
   The floor is zone-wide, so `staging.auditmos.com` inherits it. Clients that
   cannot reach TLS 1.2 are pre-2014 (Android < 5, IE 10 on Windows 7); this
   site's audience is agencies, developers and AI agents.

   Verifying this needs a client that will actually *offer* the old protocol.
   OpenSSL 3.x refuses at the client side and reports `no protocols available`,
   which looks identical to a server rejection but proves nothing:

   ```bash
   # Wrong — the local client refuses before a packet is sent
   openssl s_client -connect auditmos.com:443 -tls1_1 </dev/null

   # Right — forces the legacy offer; the server answers "alert protocol version"
   openssl s_client -connect auditmos.com:443 -servername auditmos.com \
     -tls1_1 -cipher 'ALL:@SECLEVEL=0' </dev/null

   # Or enumerate what the edge really supports, per protocol and cipher
   nmap --script ssl-enum-ciphers -p 443 auditmos.com
   ```
2. **HSTS** (same panel → **HTTP Strict Transport Security**): enabled
   2026-08-13 at **`max-age=15552000` (6 months) with `includeSubDomains`, no
   `preload`** (#27). Prefer this toggle over the `_headers` file: `_headers`
   is applied by the asset server, so it never reaches a response the Worker
   renders itself (`/mcp`, `/api/contact`) — the zone toggle covers every
   response including redirects. Nothing in the repo sets this header; keep it
   that way, or the zone and the build will fight over one header.

   `includeSubDomains` binds **every** subdomain for the whole `max-age`
   window, and no server-side change revokes it early — a browser that saw the
   policy enforces it until it expires. So **any new hostname on this zone
   needs working HTTPS before its DNS record goes live**, including the
   `www.auditmos.com` redirect floated under Decommission below. Verified
   HTTPS-only when the flag shipped: `mapy`, `staging`, `grota`, `waas`,
   `api-grota`, `pay` (Stripe). `checkout`, `wass` and `www` had no DNS.

   **Preload: deliberately not submitted.** Removal from the browser list
   takes months, so it is earned rather than claimed. Revisiting it means
   first raising `max-age` to `31536000` — hstspreload.org rejects anything
   under a year — and letting that run clean with `includeSubDomains`. The
   6-month value is otherwise a deliberate choice, not a step in a ramp.
3. **Turnstile** (Cloudflare dashboard → Turnstile): create a widget with
   hostnames `auditmos.com` **and** `staging.auditmos.com` → yields the site
   key (build-time, public) and secret key (runtime).
4. **Resend**: verify the `auditmos.com` sending domain (SPF + DKIM DNS
   records) and create an API key. Without a verified domain every form
   submission returns 502 — the endpoint requires both emails to send.
5. **Cloudflare Web Analytics** (dashboard → Web Analytics → Manage site):
   hostname `auditmos.com`, RUM set to **Enable** — "the JS Snippet will be
   automatically injected". Enabled 2026-08-13. There is **no token to copy**
   under this option; Cloudflare owns it and injects the beacon at the edge as
   the HTML response leaves for the browser. The manual *"Enable with JS Snippet
   installation"* option is the only one that surfaces a token, and this site
   does not use it — the layout emits no analytics tag, deliberately, because a
   second beacon would double-count every pageview (#39).

   Two consequences worth knowing before debugging this:

   - **Injection is gated on the request `Accept` header**, not the user-agent.
     `curl -sI https://auditmos.com/` sends a wildcard `Accept` and returns a
     beacon-free page whether or not analytics works — a false negative that
     once hid this for weeks. Check it with `pnpm agents:verify`, which sends a
     browser `Accept` and fails on zero *or* duplicate beacons.
   - **It is zone-wide.** Only `auditmos.com` is a configured hostname, yet
     `staging.auditmos.com` is served the same token, so staging traffic merges
     into production's numbers. Separating them needs Web Analytics Rules (Pro
     plan); the Worker cannot strip the tag, because the edge injects it after
     the Worker has already returned the response.

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

## Mail security (DNS)

Mail for `auditmos.com` is Google Workspace (five `aspmx.l.google.com` MX hosts).
Two systems send *as* the domain: Workspace itself, and Resend for the
`/api/contact` notification and confirmation. Everything below is a DNS record
on the zone — no code, and none of it is exercised by a deploy.

| Record | Value | Status |
| --- | --- | --- |
| `auditmos.com` TXT | `v=spf1 include:_spf.google.com ~all` | live |
| `google._domainkey` TXT | Workspace DKIM (RSA) | live |
| `resend._domainkey` TXT | Resend DKIM, `d=auditmos.com` | live |
| `send.auditmos.com` TXT | `v=spf1 include:amazonses.com ~all` — Resend's Return-Path | live |
| `_dmarc` TXT | `v=DMARC1; p=none; rua=mailto:dmarc@auditmos.com` | phase 1 of 4 (#32) |
| `_smtp._tls` TXT | `v=TLSRPTv1; rua=mailto:dmarc@auditmos.com` | live 2026-08-13 (#33) |
| `_mta-sts` TXT | `v=STSv1; id=<stamp>` | `mode: testing` (#34) |
| `mta-sts` A | Worker custom domain, serves the policy | `pnpm deploy:mta-sts` |

Both report streams land in `dmarc@auditmos.com`, which is a real Workspace
address rather than a catch-all — worth knowing, because a `rua` pointing at a
non-existent mailbox fails silently: reports are simply never delivered and the
absence looks identical to nobody sending any. Verify a destination before
publishing it:

```bash
# 250 = accepted. Probe a nonsense address in the same session — a domain that
# accepts everything tells you nothing.
printf 'EHLO x\r\nMAIL FROM:<>\r\nRCPT TO:<dmarc@auditmos.com>\r\nQUIT\r\n' \
  | nc aspmx.l.google.com 25
```

Two traps to avoid when this moves forward:

- **Do not add `include:amazonses.com` to the root SPF.** Resend passes DMARC
  via its own DKIM plus relaxed SPF alignment on `send.auditmos.com`. Adding the
  include would authorize the whole shared SES pool to send as `auditmos.com`.
- **Do not set `aspf=s` when DMARC advances** (#32 phase 3 suggests it).
  Resend's Return-Path is a *subdomain*, so strict SPF alignment fails on every
  contact-form email. `adkim=s` is safe — Resend signs as `d=auditmos.com`.

### MTA-STS

The policy is served by a **second, standalone Worker** (`workers/mta-sts/`,
deployed with `pnpm deploy:mta-sts`), not by the site Worker. That is not
fastidiousness: Workers Assets answers static assets *before* the Worker runs
for any path outside `assets.run_worker_first`, and that list matches on path,
not host. Bind `mta-sts.auditmos.com` to the site Worker and
`mta-sts.auditmos.com/og.png`, `/sitemap.xml` and `/_astro/*` are served from
the asset server without the Worker seeing them — a second URL for site content
on a hostname that exists to publish a mail policy. The only way to intercept
them would be `run_worker_first: ["/*"]`, routing every asset of the main site
through the Worker to tidy up a subdomain.

The policy text, the MX list and the 404-everything-else rule live in
`src/mail/mta-sts.ts`, shared by the Worker and its tests, so the file that mail
servers fetch has exactly one source.

**Changing the policy takes two edits, and one alone is worse than neither.**
`max_age` is a week, so senders cache it for that long and only re-fetch when
the `id` in the `_mta-sts` TXT record changes. Edit the constant *and* bump the
id in the same change:

```bash
# after editing src/mail/mta-sts.ts
pnpm deploy:mta-sts
# then bump the TXT id — any strictly-increasing value; a UTC stamp is readable
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records/$ID" \
  -H "Authorization: Bearer $CLOUDFLARE_DNS_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"content":"v=STSv1; id=20260813120000"}'

pnpm mta-sts:verify   # TXT id present, policy 200 text/plain, mx == live MX
```

`pnpm mta-sts:verify` is the gate for the `testing` → `enforce` flip. Under
`enforce`, an MX list that does not match DNS **refuses inbound mail**, and
that is a failure no test in this repo can see: the MX records live in
Cloudflare DNS and change without the repo being touched. Flip the mode only
after TLS-RPT has been quiet for a week — that is what `testing` is for.

TLS-RPT reports arrive as gzipped JSON, at most once per sending domain per day,
and only from senders that implement it — in practice Google and Microsoft. It
exists so that a failed STARTTLS or a certificate problem on *inbound* mail is
visible at all; without it, mail either arrives or does not and nothing says why.
It is also the prerequisite for MTA-STS: that policy is deployed in `testing`
mode first precisely so failures get reported instead of blocking mail, and
TLS-RPT is what reports them.

## Agent discovery: DNS-AID records + DNSSEC

**Status (2026-08-07): complete.** Records published, zone signed, DS published
at the registrar, chain validating (`AD=true`). Live endpoints these advertise:

- `https://auditmos.com/mcp` — the MCP agent (Streamable HTTP, read-only, no auth)
- `https://auditmos.com/agents.json` — the DNS-AID organization index

Zone `auditmos.com` = `ad5e7ce03e9251ad90ca97c7f03109b2`. Registrar is **eNom**,
not Cloudflare Registrar, so the DS has to be pasted there by hand.

### Credentials

`wrangler login`'s OAuth session carries `zone (read)` only and cannot write DNS.
Do **not** name this token `CLOUDFLARE_API_TOKEN`: wrangler reads that name out of
`.env` and prefers it over your `wrangler login` session, so a DNS-scoped token in
that slot silently breaks every `pnpm deploy:*` with `Authentication error [code:
10000]`. Keep deploys on OAuth and give DNS its own variable.

These commands need `CLOUDFLARE_DNS_API_TOKEN` in `.env` (gitignored) from a token
scoped to `auditmos.com` with **Zone → DNS → Edit**, **Zone → Zone → Read**, and
**Zone → Zone Settings → Edit**.

### 1. The records

Published 2026-08-07, per
[draft-mozleywilliams-dnsop-dnsaid-02](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/).
The `create` calls below are kept for rebuilding the zone from scratch.

**Sign the zone before publishing the records, not after.** These went up about
seven minutes before DNSSEC was activated, and that ordering cost roughly an
hour of mixed results. A resolver that still held `.com`'s "no DS, treat as
insecure" proof (900 s negative TTL) marked any record it fetched in that window
as unvalidated — and cached that verdict for the record's full 3600 s TTL. The
records were correct the whole time; a share of resolvers simply reported
`AD=false` until those entries aged out. Signing first avoids the window
entirely.

```dns
; Organization index (section 3.2) — ServiceMode. TargetName must be
; underscore-free because the index is fetched over TLS with a public cert.
_index._agents.auditmos.com.  300 IN SVCB 1 auditmos.com. alpn="h2" port="443"

; The MCP agent at its primary owner name (section 3.1) — ServiceMode.
; One agent protocol per record: alpn carries mcp plus the h2 transport.
mcp.auditmos.com.             300 IN SVCB 1 auditmos.com. alpn="mcp,h2" port="443"

; DNS-SD label for the same agent (section 3.1) — AliasMode (priority 0)
; MUST point at the primary owner rather than repeat its parameters.
_mcp._agents.auditmos.com.    300 IN SVCB 0 mcp.auditmos.com.
```

TTL is **300**, not Cloudflare's usual hour. These are discovery records that
change rarely but whose cached state is painful when wrong: at 3600 s a bad or
unvalidated answer sticks around for an hour with no way to purge it, since
nothing you control can flush a third-party resolver cache. Five minutes keeps
the blast radius of any future edit or DNSSEC key rotation small.

SVCB carries host, port, and protocol but no URL path. `/agents.json` closes
that gap: it lists each agent's exact endpoint. The draft's `well-known`
SvcParamKey is not registered yet, so if you want the path in DNS too, add
`key65280="/mcp"` (RFC 9460 private-use range) — drop it if Cloudflare rejects
the unknown key, since nothing depends on it.

```bash
set -a; . ./.env; set +a
ZONE_ID=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_DNS_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=auditmos.com" \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).result[0].id")

create() {
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_DNS_API_TOKEN" \
    -H "Content-Type: application/json" --data "$1" \
    | node -pe "const r=JSON.parse(require('fs').readFileSync(0)); r.success ? 'ok '+r.result.name : 'FAILED '+JSON.stringify(r.errors)"
}

create '{"type":"SVCB","name":"_index._agents.auditmos.com","ttl":300,"data":{"priority":1,"target":"auditmos.com","value":"alpn=\"h2\" port=\"443\""}}'
create '{"type":"SVCB","name":"mcp.auditmos.com","ttl":300,"data":{"priority":1,"target":"auditmos.com","value":"alpn=\"mcp,h2\" port=\"443\""}}'
create '{"type":"SVCB","name":"_mcp._agents.auditmos.com","ttl":300,"data":{"priority":0,"target":"mcp.auditmos.com","value":""}}'
```

Verify the way the scanner does — DNS-over-HTTPS, type 64 (SVCB):

```bash
for n in _index._agents.auditmos.com mcp.auditmos.com _mcp._agents.auditmos.com; do
  curl -s -H "accept: application/dns-json" \
    "https://cloudflare-dns.com/dns-query?name=$n&type=SVCB" \
    | node -pe "const j=JSON.parse(require('fs').readFileSync(0)); '$n -> '+(j.Answer?.map(a=>a.data).join(' | ') ?? 'NXDOMAIN')"
done
```

### 2. DNSSEC — complete, and the order it was done in

**A DS record that does not match the zone makes auditmos.com unresolvable for
every validating resolver.** Sign first, publish the DS second, never the
reverse, and do not disable signing while a DS is still published at the parent.
That last sentence is the standing rule, not a one-off: disabling Cloudflare
signing while eNom still publishes the DS takes the domain down.

Done 2026-08-07. Cloudflare reports `status: active`, the DS resolves at the
parent, and validating resolvers return `AD=true`. The steps are kept below
because they are the procedure for a key rotation, not just the initial setup.

```bash
# 1. DONE — enable signing. Inert until the DS is published; returns the DS.
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dnssec" \
  -H "Authorization: Bearer $CLOUDFLARE_DNS_API_TOKEN" \
  -H "Content-Type: application/json" --data '{"status":"active"}' \
  | node -pe "const r=JSON.parse(require('fs').readFileSync(0)).result; JSON.stringify({ds:r.ds,key_tag:r.key_tag,algorithm:r.algorithm,digest_type:r.digest_type,digest:r.digest},null,2)"

# 2. DONE — zone is serving DNSKEY (2 answers: KSK + ZSK).
curl -s -H "accept: application/dns-json" \
  "https://cloudflare-dns.com/dns-query?name=auditmos.com&type=DNSKEY" \
  | node -pe "'DNSKEY answers: '+(JSON.parse(require('fs').readFileSync(0)).Answer?.length ?? 0)"
```

3. **DONE —** the DS below is published in eNom's DNSSEC / DS record form for
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

As of 2026-08-07 all four discoverability checks pass: `robotsTxt`, `sitemap`,
`linkHeaders`, `dnsAid`. Verified with 25 consecutive scanner runs and 60
`AD=true` DoH samples across the three records.

**Sample before you believe a result here.** The scanner resolves over DoH
against an anycast resolver, so a single run reports whichever backend instance
answered. While stale cache entries were still aging out, consecutive runs
returned `fail, fail, pass` for a configuration that never changed. One pass
proves nothing and one failure proves nothing; look for a run of them.

To tell a genuine misconfiguration apart from cache, query the authoritative
servers directly — this bypasses every resolver cache and shows whether the
records exist and are signed. Note that macOS `dig` 9.10 does not know the
`SVCB` mnemonic and will silently query type `A` instead, so ask for `TYPE64`:

```bash
dig +dnssec +norec +noall +answer @brodie.ns.cloudflare.com \
  _index._agents.auditmos.com TYPE64
```

An answer with both a `TYPE64` record and an `RRSIG TYPE64` means the zone side
is correct and any `AD=false` you see is a resolver cache that will age out.
