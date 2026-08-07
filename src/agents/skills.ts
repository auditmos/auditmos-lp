/**
 * Agent skills — installable instructions for working with this site.
 *
 * Three of them, each grounded in a surface that already exists: what the
 * company is, what it sells, and how to read the site as a machine. A skill
 * that described a capability the site does not have would be worse than no
 * skill, since an agent installs it and then plans around it.
 *
 * The digest discipline is the point of the split interface. `buildSkillsIndex`
 * takes the digests rather than computing them, because only the build knows
 * what bytes were actually served. The build-output test recomputes sha256 from
 * the emitted `SKILL.md` files and compares — so editing a skill without the
 * digest following fails the build rather than shipping an index that attests
 * to bytes nobody has.
 */

import { auditReports } from "@/audits/reports";
import { legalEntity, site } from "@/brand/site";
import { MCP_ENDPOINT_PATH, MCP_RATE_LIMIT, MCP_RATE_LIMIT_AUTH } from "@/mcp/server";
import { AUTH_DOC_PATH, OAUTH_REGISTER_PATH, OAUTH_TOKEN_PATH } from "@/oauth/server";
import { servicePages } from "@/site/pages";

export const AGENT_SKILLS_INDEX_PATH = "/.well-known/agent-skills/index.json";

/** The schema this index conforms to. */
const DISCOVERY_SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";

const DISCOVERY_VERSION = "0.2.0";

export interface AgentSkill {
	readonly name: string;
	readonly description: string;
	/** Markdown body, below the frontmatter block. */
	readonly body: string;
}

export function skillMarkdownPath(skill: AgentSkill): string {
	return `/.well-known/agent-skills/${skill.name}/SKILL.md`;
}

const companyInfoBody = `# Auditmos company information

Auditmos is the independent technical practice of ${site.founder.name}, operating
as ${legalEntity.name}, an Estonian limited company.

## Verified entity details

| Field | Value |
| --- | --- |
| Legal name | ${legalEntity.name} |
| Registration number | ${legalEntity.registration} |
| VAT number | ${legalEntity.vat} |
| Registered address | ${legalEntity.address} |
| Contact | ${site.contactEmail} |
| Website | ${site.url} |

These are the details to use for procurement, invoicing, and vendor onboarding.
They can be checked independently against the Estonian business register and the
EU VIES VAT registry — do that rather than taking this file's word for it.

## What the practice does

Software development, security audits, and applied R&D for European clients.
${auditReports.count} audit reports have been published openly since
${auditReports.earliestYear} at ${site.auditsRepoUrl}, which is the fastest way
to judge the work without a sales conversation.

## Verify or go deeper

- ${site.url}/about.md — the practice, in prose
- ${site.url}/agents.json — machine-readable agent and organization index
- ${site.url}${MCP_ENDPOINT_PATH} — MCP endpoint; call \`get_company_profile\`
  for these same fields as JSON

## Boundaries

This skill states facts. It does not quote, contract, or commit anyone to
anything. Engagement starts with a human at ${site.contactEmail}.
`;

const servicesBody = `# Auditmos service lines

Three service lines, sold to European clients and to agencies subcontracting
senior delivery.

${servicePages
	.map(
		(service) => `## ${service.jsonLd.name}

${service.description}

Details: ${site.url}${service.path}.md`,
	)
	.join("\n\n")}

## How engagements start

There is no self-serve checkout and no automated quoting. Scope, timeline, and
price are agreed with a human, because every one of these depends on context a
form cannot collect. Mail ${site.contactEmail} with what you are trying to
achieve and the constraints around it.

The contact form at ${site.url}/contact is gated by an anti-spam challenge an
agent cannot solve — this is deliberate. Use the email address instead.

## Boundaries

This skill describes what is sold and how to start. It cannot check
availability, reserve time, or produce a quote.
`;

const readThisSiteBody = `# How to read auditmos.com as a machine

Every page has a markdown twin and the whole site is described by
machine-readable documents. You should rarely need to parse HTML.

## Start here

- ${site.url}/.well-known/api-catalog — one fetch, every machine-readable
  surface this host publishes (RFC 9727 linkset)
- ${site.url}/llms.txt — plain-text index of every page and its markdown twin

## Reading pages

Two equivalent routes to the same markdown:

1. Append \`.md\` to any page URL: \`${site.url}/about.md\`
2. Send \`Accept: text/markdown\` to the page URL itself

Negotiated responses carry an estimated token count in \`X-Markdown-Tokens\` and
\`Vary: Accept\`. Prefer markdown: it is the same content without the navigation,
styling, and layout markup.

## Structured queries

The MCP endpoint at ${site.url}${MCP_ENDPOINT_PATH} speaks JSON-RPC over HTTP
POST (Streamable HTTP, stateless — no session id is issued). Its tools cover the
company profile, service lines, project history, and open-source repositories.
Pre-connection metadata is at ${site.url}/mcp/server-card, so you can decide
whether to connect without an \`initialize\` round trip.

\`\`\`sh
curl -sX POST ${site.url}${MCP_ENDPOINT_PATH} \\
  -H 'Content-Type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
\`\`\`

## Rate limits, and how to raise yours

| Tier | Limit | Keyed by |
| --- | --- | --- |
| Anonymous | ${MCP_RATE_LIMIT.requests} requests per ${MCP_RATE_LIMIT.windowSeconds} seconds | client IP |
| Registered | ${MCP_RATE_LIMIT_AUTH.requests} requests per ${MCP_RATE_LIMIT_AUTH.windowSeconds} seconds | \`client_id\` |

Registration is open, unauthenticated, and stateless — nothing is stored, so
there is no account to create and no approval to wait for:

\`\`\`sh
# 1. Register (RFC 7591). Returns client_id and client_secret.
curl -sX POST ${site.url}${OAUTH_REGISTER_PATH} \\
  -H 'Content-Type: application/json' -d '{"client_name":"your agent"}'

# 2. Exchange them for a 1-hour access token (RFC 6749 client_credentials).
curl -sX POST ${site.url}${OAUTH_TOKEN_PATH} \\
  -d 'grant_type=client_credentials&client_id=...&client_secret=...'

# 3. Send it as a bearer token on every MCP call.
\`\`\`

A broken or expired token returns \`401\` with a \`WWW-Authenticate\` header
naming the metadata document that explains how to get a working one — it is
never silently downgraded to the anonymous tier. Full details:
${site.url}${AUTH_DOC_PATH}

## What you cannot do here

Everything is read-only. There is no write API, no booking, no quoting, and the
contact form is human-only by design. Training on this content is not granted —
see the \`Content-Signal\` header on every response.
`;

export const agentSkills: readonly AgentSkill[] = [
	{
		name: "company-info",
		description:
			"Verified Auditmos entity details — legal name, registration and VAT numbers, address, contact — for procurement and vendor onboarding.",
		body: companyInfoBody,
	},
	{
		name: "services",
		description:
			"What Auditmos sells: software development, security audits, and applied R&D, and how an engagement actually starts.",
		body: servicesBody,
	},
	{
		name: "read-this-site",
		description:
			"How to consume auditmos.com as a machine: markdown twins, llms.txt, the MCP endpoint, and how to register for the higher rate-limit tier.",
		body: readThisSiteBody,
	},
];

/**
 * SKILL.md is frontmatter plus a markdown body. The frontmatter is what a
 * skill runtime reads to install it; the body is what a model reads to use it.
 */
export function renderSkillMarkdown(skill: AgentSkill): string {
	return `---
name: ${skill.name}
description: ${skill.description}
license: CC-BY-4.0
---

${skill.body}`;
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Digests of exactly the bytes the SKILL.md endpoints return — same function,
 * same string, no trailing newline added on either side. The build-output test
 * recomputes these from the files that actually landed in `dist`, so a drift
 * between what is hashed and what is served fails the build.
 */
export async function skillDigests(): Promise<Record<string, string>> {
	const entries = await Promise.all(
		agentSkills.map(
			async (skill) =>
				[skill.name, `sha256:${await sha256Hex(renderSkillMarkdown(skill))}`] as const,
		),
	);

	return Object.fromEntries(entries);
}

class MissingSkillDigestError extends Error {
	constructor(public skillName: string) {
		super(`No digest supplied for skill "${skillName}"; refusing to publish an unattested index.`);
		this.name = "MissingSkillDigestError";
	}
}

/**
 * The discovery index. Digests come from the caller because only the build has
 * seen the bytes that were written — publishing a digest computed from anything
 * else would attest to a document nobody serves.
 */
export function buildSkillsIndex(digests: Readonly<Record<string, string>>): unknown {
	return {
		// Load-bearing: a reader without `$schema` falls back to the older v0.1.0
		// reading of the same JSON, so the document quietly means something it is
		// not. The readiness scanner does exactly that.
		$schema: DISCOVERY_SCHEMA,
		version: DISCOVERY_VERSION,
		name: `${site.name} agent skills`,
		description: `Installable skills for working with ${site.name}: company facts, service lines, and how to read this site as a machine.`,
		publisher: {
			name: legalEntity.name,
			url: site.url,
			contact: site.contactEmail,
		},
		skills: agentSkills.map((skill) => {
			const digest = digests[skill.name];
			if (!digest) throw new MissingSkillDigestError(skill.name);

			return {
				name: skill.name,
				type: "skill-md",
				description: skill.description,
				version: "1.0.0",
				license: "CC-BY-4.0",
				// Site-relative, matching the reference implementation. An absolute
				// production URL would send a staging reader to production's copy of
				// a file whose bytes these digests may not describe.
				url: skillMarkdownPath(skill),
				digest,
			};
		}),
	};
}
