/**
 * `/auth.md` — the prose twin of the OAuth metadata documents.
 *
 * Generated rather than written, for the same reason the API catalog is
 * projected rather than listed: every number and URL in it comes from the
 * constant the server enforces, so the page cannot promise a limit nobody
 * applies or an endpoint nobody serves. A hand-maintained auth page is always
 * one edit away from being a lie, and this is the page an agent reads when it
 * is deciding whether to trust the site at all.
 *
 * It ships in the same slice as the authenticated tier because its central
 * claim — what a credential buys — only became true when that tier existed.
 */

import { site } from "@/brand/site";
import { MCP_ENDPOINT_PATH, MCP_RATE_LIMIT, MCP_RATE_LIMIT_AUTH } from "@/mcp/server";
import {
	ACCESS_TOKEN_TTL_SECONDS,
	OAUTH_AUTHORIZATION_SERVER_PATHS,
	OAUTH_PROTECTED_RESOURCE_PATH,
	OAUTH_REGISTER_PATH,
	OAUTH_SCOPE,
	OAUTH_TOKEN_PATH,
} from "./server";

function rate(limit: { requests: number; windowSeconds: number }): string {
	return `${limit.requests} requests per ${limit.windowSeconds} seconds`;
}

export function renderAuthMarkdown(): string {
	// The heading names the document, not the topic: the auth.md convention
	// identifies the file by its H1, and tooling that cannot find the name there
	// treats the document as absent no matter how well it reads.
	return `# auth.md — authentication and rate limits at Auditmos

Everything on auditmos.com is public. Authentication here raises a rate-limit
ceiling; it does not unlock content. If you only want to read the site, you can
stop reading this page — **no credential is required for anything**.

## What is public

All of it. Every page, its markdown twin at \`<path>.md\`, \`/llms.txt\`, the
sitemap, the agent index at \`/agents.json\`, the MCP Server Card, and the MCP
endpoint at \`${MCP_ENDPOINT_PATH}\` answer without a credential. There is no
private tier, no paywall, and no content that appears only once you have a
token. Registering tells us nothing about you that you did not choose to send.

## What a credential buys

One thing: a higher rate limit on \`${MCP_ENDPOINT_PATH}\`.

| Tier | Limit | Keyed by |
| --- | --- | --- |
| Anonymous | ${rate(MCP_RATE_LIMIT)} | client IP |
| Authenticated | ${rate(MCP_RATE_LIMIT_AUTH)} | \`client_id\` |

The authenticated tier is also the better-behaved one: anonymous callers share a
bucket with everyone else behind the same IP, so an agent running from a cloud
region or a shared NAT is competing with strangers. A credential gives you your
own bucket.

Exceeding either limit returns HTTP 429 with a \`Retry-After\` header. The limiter
is permissive and eventually consistent by design — it bounds sustained abuse
rather than enforcing a hard quota — so pace yourself by the numbers above
rather than by probing for the edge.

## How to register

Registration is open, unauthenticated, and stateless. Nothing is stored: your
client secret is derived from your client id, so there is no account, no
database row, and nothing to leak.

\`\`\`sh
# 1. Register. Returns client_id, client_secret, and the token endpoint.
curl -sX POST ${site.url}${OAUTH_REGISTER_PATH} \\
  -H 'Content-Type: application/json' \\
  -d '{"client_name":"your agent"}'

# 2. Exchange them for an access token (RFC 6749 client_credentials).
curl -sX POST ${site.url}${OAUTH_TOKEN_PATH} \\
  -d 'grant_type=client_credentials&client_id=...&client_secret=...'

# 3. Call the MCP endpoint with it.
curl -sX POST ${site.url}${MCP_ENDPOINT_PATH} \\
  -H 'Authorization: Bearer ...' \\
  -H 'Content-Type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
\`\`\`

Access tokens are \`HS256\` JWTs valid for ${ACCESS_TOKEN_TTL_SECONDS} seconds
with scope \`${OAUTH_SCOPE}\`. Client secrets do not expire. The
\`client_credentials\` grant is the only one implemented — there are no user
accounts here to authorize on behalf of, so the redirect-based grants would be
theatre.

## Identity types

- **Anonymous.** No \`Authorization\` header. Full read access, lower limit.
- **Registered client.** A \`client_credentials\` identity, self-declared. It
  identifies a caller across requests so the limit can be applied per client,
  and nothing else. We do not verify who you are and do not ask.

A request carrying a broken or expired bearer token is refused with \`401\` and a
\`WWW-Authenticate\` header naming
\`${OAUTH_PROTECTED_RESOURCE_PATH}\` — it is never silently downgraded to the
anonymous tier, because a client whose token quietly stopped working would see
unexplained 429s instead of a fixable error.

## Revocation and contact

There is nothing stored to revoke. A token expires on its own within
${ACCESS_TOKEN_TTL_SECONDS} seconds; a client secret stays valid as long as the
signing key does. If a credential needs to be invalidated sooner, the signing key
is rotated, which invalidates every credential at once — so tell us rather than
work around it: ${site.contactEmail}.

If you believe you are being rate limited unfairly, or need a higher ceiling for
a legitimate integration, mail the same address. It reaches a person.

## Every machine-readable surface

- \`${site.url}/.well-known/api-catalog\` — the index of everything below (RFC 9727)
- \`${site.url}${OAUTH_AUTHORIZATION_SERVER_PATHS[0]}\` — authorization server metadata (RFC 8414)
- \`${site.url}${OAUTH_AUTHORIZATION_SERVER_PATHS[1]}\` — the same document, OpenID discovery path
- \`${site.url}${OAUTH_PROTECTED_RESOURCE_PATH}\` — protected resource metadata for \`${MCP_ENDPOINT_PATH}\` (RFC 9728)
- \`${site.url}/llms.txt\` — site index for agents
- \`${site.url}/agents.json\` — agent inventory
- \`${site.url}/mcp/server-card\` — MCP Server Card
`;
}
