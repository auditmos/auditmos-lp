/**
 * The A2A v0.3 Agent Card.
 *
 * A2A is agent-to-agent discovery: a card tells another agent who this one is,
 * what it can do, and how to talk to it, before any protocol handshake. This
 * card describes the surface that exists — read-only HTTP+JSON over public
 * company data, served by the MCP endpoint — and nothing more.
 *
 * There is no A2A JSON-RPC server here, and the card does not pretend there is.
 * Advertising `JSONRPC` transport would win the same discovery check and cost a
 * client a failed task to find out it was false; a card that describes a real
 * HTTP+JSON surface is the honest version of the same document. A live A2A
 * server is future work, not a fiction to ship now.
 *
 * Skills are derived from the MCP tool registry rather than listed, so a tool
 * removed from the server disappears from the card in the same commit. The card
 * cannot overclaim because it has nothing of its own to claim with.
 */

import { legalEntity, site } from "@/brand/site";
import { MCP_ENDPOINT_PATH, MCP_SERVER_INFO } from "@/mcp/server";
import { createSiteTools, type McpProjectEntry } from "@/mcp/tools";

/** Where A2A v0.3 reserves the card. */
export const A2A_AGENT_CARD_PATH = "/.well-known/agent-card.json";

const A2A_PROTOCOL_VERSION = "0.3.0";

/**
 * The boundary, stated in the field every A2A client displays. An agent that
 * reads this should be able to decide "nothing I need" without a round trip,
 * and should never plan a task around a capability that will refuse it.
 */
const AGENT_DESCRIPTION =
	"Read-only HTTP+JSON access to public Auditmos company data: entity and " +
	"contact details, service lines, project history, and open-source " +
	"repositories. No writes, no streaming, no long-running tasks. Starting an " +
	"engagement is human-only — the contact form is gated by a challenge an " +
	"agent cannot solve, so use the published email address instead.";

export function buildAgentCard(projects: readonly McpProjectEntry[]): unknown {
	return {
		protocolVersion: A2A_PROTOCOL_VERSION,
		// Identity comes from the constant `initialize` answers with, so the card
		// and the live handshake cannot disagree.
		name: MCP_SERVER_INFO.title,
		description: AGENT_DESCRIPTION,
		version: MCP_SERVER_INFO.version,
		url: `${site.url}${MCP_ENDPOINT_PATH}`,
		preferredTransport: "HTTP+JSON",
		// The list a client picks a transport from. One entry, because there is
		// one way in — but the field is required, and a card without it parses
		// cleanly while telling a client nothing it can act on.
		supportedInterfaces: [{ url: `${site.url}${MCP_ENDPOINT_PATH}`, transport: "HTTP+JSON" }],
		provider: {
			organization: legalEntity.name,
			url: site.url,
		},
		documentationUrl: `${site.url}/llms.txt`,
		// Declared false rather than omitted: "we do not stream" is information,
		// "unspecified" is a question the client has to answer by trying.
		capabilities: {
			streaming: false,
			pushNotifications: false,
		},
		defaultInputModes: ["text/plain"],
		defaultOutputModes: ["application/json", "text/plain"],
		skills: createSiteTools(projects).map((tool) => ({
			id: tool.name,
			name: tool.title,
			description: tool.description,
			tags: ["auditmos", "read-only", "public-data"],
		})),
	};
}
