import { getCollection } from "astro:content";
import { buildAgentCard } from "@/agents/agent-card";

export const prerender = true;

/**
 * The A2A v0.3 Agent Card. Prerendered like every other discovery document —
 * a card that only answers when the Worker is warm is a card another agent
 * learns not to rely on.
 *
 * Reads the projects collection because the card's skills are derived from the
 * MCP tool registry, and the tools are built over the same project data the
 * live endpoint serves.
 */
export async function GET(): Promise<Response> {
	const projects = await getCollection("projects");

	return new Response(`${JSON.stringify(buildAgentCard(projects), null, 2)}\n`, {
		status: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
