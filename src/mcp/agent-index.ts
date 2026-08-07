/**
 * The organization agent index — the document `_index._agents.auditmos.com`
 * resolves to, per draft-mozleywilliams-dnsop-dnsaid-02 section 3.2.
 *
 * DNS-AID deliberately leaves the index's schema out of scope: SVCB carries the
 * connectivity, this document carries the inventory. An agent that has followed
 * the DNS record lands here and gets exact endpoint URLs, which a DNS record
 * alone cannot express — SVCB conveys host, port, and protocol, but no path.
 *
 * The agent list is derived from the live tool registry, so an index that
 * advertises a tool the server does not serve cannot be built.
 */

import { legalEntity, site } from "@/brand/site";
import { AUTH_DOC_PATH, OAUTH_REGISTER_PATH, OAUTH_SCOPE, OAUTH_TOKEN_PATH } from "@/oauth/server";
import { MARKDOWN_MEDIA_TYPE, MARKDOWN_TOKENS_HEADER } from "@/site/markdown-negotiation";
import {
	MCP_ENDPOINT_PATH,
	MCP_PROTOCOL_VERSION,
	MCP_RATE_LIMIT,
	MCP_RATE_LIMIT_AUTH,
} from "./server";
import { AI_CATALOG_PATH, SERVER_CARD_PATH } from "./server-card";
import { createSiteTools, type McpProjectEntry } from "./tools";

/** The agent's primary owner name in DNS, per DNS-AID section 3.1. */
export const MCP_AGENT_DNS_NAME = "mcp.auditmos.com";

export function buildAgentIndex(projects: readonly McpProjectEntry[]): unknown {
	const tools = createSiteTools(projects);

	return {
		organization: {
			name: site.name,
			legalName: legalEntity.name,
			registration: legalEntity.registration,
			url: site.url,
			contact: site.contactEmail,
		},
		agents: [
			{
				name: "auditmos",
				title: "Auditmos",
				description:
					"Read-only access to the Auditmos company profile, service lines, project " +
					"history, and open-source repositories.",
				protocol: "mcp",
				protocolVersion: MCP_PROTOCOL_VERSION,
				transport: "streamable-http",
				endpoint: `${site.url}${MCP_ENDPOINT_PATH}`,
				dnsName: MCP_AGENT_DNS_NAME,
				// SEP-2127 Server Card: the pre-connection metadata a client needs
				// to reach this endpoint without an initialize round trip first.
				serverCard: `${site.url}${SERVER_CARD_PATH}`,
				// Optional, not required: everything answers without a credential.
				// Registering raises the rate limit and nothing else, which is why
				// the tiers are stated right below rather than hidden behind it.
				authentication: {
					required: false,
					scheme: "oauth2",
					grantType: "client_credentials",
					registrationEndpoint: `${site.url}${OAUTH_REGISTER_PATH}`,
					tokenEndpoint: `${site.url}${OAUTH_TOKEN_PATH}`,
					scope: OAUTH_SCOPE,
					documentation: `${site.url}${AUTH_DOC_PATH}`,
				},
				readOnly: true,
				// Published so a client can pace itself rather than discover the
				// limit by being refused. Same constants the endpoint enforces.
				rateLimit: {
					requests: MCP_RATE_LIMIT.requests,
					windowSeconds: MCP_RATE_LIMIT.windowSeconds,
					scope: "per client IP",
					onExceeded: "HTTP 429 with a Retry-After header",
					authenticated: {
						requests: MCP_RATE_LIMIT_AUTH.requests,
						windowSeconds: MCP_RATE_LIMIT_AUTH.windowSeconds,
						scope: "per registered client_id",
					},
				},
				tools: tools.map((tool) => ({
					name: tool.name,
					title: tool.title,
					description: tool.description,
				})),
			},
		],
		// Not agents, but the other machine-readable surfaces an arriving agent
		// will want — the same ones the RFC 8288 Link headers advertise.
		documents: {
			llmsTxt: `${site.url}/llms.txt`,
			sitemap: `${site.url}/sitemap.xml`,
			// Domain-level MCP discovery (SEP-2127): lists the Server Cards this
			// host publishes, so a crawler needs no prior knowledge of them.
			aiCatalog: `${site.url}${AI_CATALOG_PATH}`,
			markdownMirror: `Every page URL also answers at <path>.md as ${MARKDOWN_MEDIA_TYPE}.`,
			// The second route to the same document, for a client that would
			// rather negotiate than rewrite paths. Names come from the module
			// that enforces them, so this cannot advertise a contract the
			// Worker does not honour.
			markdownNegotiation:
				`Sending Accept: ${MARKDOWN_MEDIA_TYPE} to any page URL returns that page as ` +
				`markdown instead of HTML; HTML stays the default for requests that do not ask. ` +
				`Negotiated responses carry an estimated token count in ${MARKDOWN_TOKENS_HEADER}, ` +
				`plus Vary: Accept.`,
		},
	};
}
