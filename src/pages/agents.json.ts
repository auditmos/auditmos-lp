import { getCollection } from "astro:content";
import { buildAgentIndex } from "@/mcp/agent-index";

export const prerender = true;

/**
 * The DNS-AID organization index. `_index._agents.auditmos.com` resolves here,
 * so it stays prerendered — a discovery entry point should not depend on the
 * Worker being warm.
 */
export async function GET(): Promise<Response> {
	const body = JSON.stringify(buildAgentIndex(await getCollection("projects")), null, 2);

	return new Response(body, {
		status: 200,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}
