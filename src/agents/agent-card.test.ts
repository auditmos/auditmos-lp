/**
 * TDD assumptions for issue #15:
 * - The tested interface is `buildAgentCard(projects)`, the A2A v0.3 document.
 * - Its correctness is not "matches the schema" but "cannot overclaim": skills
 *   are derived from the live MCP tool registry and identity from
 *   `MCP_SERVER_INFO`, so the card cannot describe a capability that no longer
 *   exists.
 * - No A2A JSON-RPC endpoint exists, and the card must not pretend otherwise.
 * - That the card is prerendered and its URLs resolve is asserted against real
 *   build output in `src/site/build-output.test.ts`.
 */

import { site } from "@/brand/site";
import { MCP_ENDPOINT_PATH, MCP_SERVER_INFO } from "@/mcp/server";
import { createSiteTools, type McpProjectEntry } from "@/mcp/tools";
import { A2A_AGENT_CARD_PATH, buildAgentCard } from "./agent-card";

const projects = [
	{
		data: {
			title: "Auditmos Website Rebuild",
			slug: "auditmos-website-rebuild",
			summary: "A static-first rebuild for a trust-focused company website.",
			client: { name: "Auditmos OÜ" },
			stack: [],
			featured: true,
			links: [],
		},
		body: "Auditmos needed a concise public surface.",
	},
] as const satisfies readonly McpProjectEntry[];

interface AgentCard {
	protocolVersion: string;
	name: string;
	description: string;
	version: string;
	url: string;
	preferredTransport: string;
	supportedInterfaces: { url: string; transport: string }[];
	provider: { organization: string; url: string };
	capabilities: { streaming: boolean; pushNotifications: boolean };
	defaultInputModes: string[];
	defaultOutputModes: string[];
	skills: { id: string; name: string; description: string; tags: string[] }[];
}

const card = buildAgentCard(projects) as AgentCard;

describe("buildAgentCard", () => {
	it("is served where the A2A spec reserves the card", () => {
		expect(A2A_AGENT_CARD_PATH).toBe("/.well-known/agent-card.json");
	});

	it("carries the fields a client parses before deciding to connect", () => {
		expect(card.protocolVersion).toBe("0.3.0");
		expect(card.name).not.toBe("");
		expect(card.version).not.toBe("");
		expect(card.url).toBe(`${site.url}${MCP_ENDPOINT_PATH}`);
		expect(card.preferredTransport).toBe("HTTP+JSON");
	});

	it("enumerates the interfaces it can actually be reached on", () => {
		// A2A v0.3 requires `supportedInterfaces`, and it is not decoration: a
		// client picks a transport from this list. Omitting it left the card
		// parseable and unusable — no entry meant no way in.
		expect(card.supportedInterfaces).toEqual([
			{ url: `${site.url}${MCP_ENDPOINT_PATH}`, transport: "HTTP+JSON" },
		]);
	});

	it("offers no interface it does not serve", () => {
		for (const interfaceEntry of card.supportedInterfaces) {
			expect(interfaceEntry.transport).toBe(card.preferredTransport);
			expect(interfaceEntry.url).toBe(card.url);
		}
	});

	it("states the same identity the live server reports on initialize", () => {
		// A card that contradicts the handshake is worse than no card: a client
		// would have to decide which of the two to believe.
		expect(card.name).toBe(MCP_SERVER_INFO.title);
		expect(card.version).toBe(MCP_SERVER_INFO.version);
	});

	it("derives every skill from the live MCP tool registry", () => {
		const toolNames = createSiteTools(projects).map((tool) => tool.name);

		// Derived, not listed: a tool removed from the server disappears from the
		// card in the same commit, so the card cannot advertise a capability the
		// endpoint would refuse.
		expect(card.skills.map((skill) => skill.id)).toEqual(toolNames);
	});

	it("gives each skill the tool's own name and description", () => {
		const tools = createSiteTools(projects);

		for (const [index, skill] of card.skills.entries()) {
			expect({ id: skill.id, name: skill.name, description: skill.description }).toEqual({
				id: tools[index].name,
				name: tools[index].title,
				description: tools[index].description,
			});
			expect(skill.tags.length).toBeGreaterThan(0);
		}
	});

	it("states the boundary of what this agent will do", () => {
		const description = card.description.toLowerCase();

		expect(description).toContain("read-only");
		expect(description).toContain("no writes");
		expect(description).toContain("no streaming");
		// The contact form is gated on a challenge an agent cannot solve, and
		// saying so is more useful than letting one discover it by failing.
		expect(description).toContain("human");
	});

	it("declares the capabilities it does not have rather than omitting them", () => {
		expect(card.capabilities).toEqual({ streaming: false, pushNotifications: false });
	});

	it("names the operator behind the agent", () => {
		expect(card.provider).toEqual({ organization: "Auditmos OÜ", url: site.url });
	});

	it("exchanges text, which is all its tools return", () => {
		expect(card.defaultInputModes).toEqual(["text/plain"]);
		expect(card.defaultOutputModes).toEqual(["application/json", "text/plain"]);
	});

	it("does not claim an A2A JSON-RPC endpoint the site does not run", () => {
		// The card describes the HTTP+JSON surface that exists. Advertising
		// JSONRPC here would be a fiction a client would find out about by
		// getting a 404 mid-task.
		expect(JSON.stringify(card)).not.toContain("JSONRPC");
		expect(JSON.stringify(card)).not.toContain("GRPC");
	});
});
