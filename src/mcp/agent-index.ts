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
import { MCP_PROTOCOL_VERSION, MCP_RATE_LIMIT } from "./server";
import { createSiteTools, type McpProjectEntry } from "./tools";

/** Where the MCP agent actually answers. */
export const MCP_ENDPOINT_PATH = "/mcp";

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
				authentication: "none",
				readOnly: true,
				// Published so a client can pace itself rather than discover the
				// limit by being refused. Same constant the endpoint enforces.
				rateLimit: {
					requests: MCP_RATE_LIMIT.requests,
					windowSeconds: MCP_RATE_LIMIT.windowSeconds,
					scope: "per client IP",
					onExceeded: "HTTP 429 with a Retry-After header",
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
			markdownMirror: "Every page URL also answers at <path>.md as text/markdown.",
		},
	};
}
