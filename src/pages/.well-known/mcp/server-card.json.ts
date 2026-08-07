import { buildServerCard } from "@/mcp/server-card";

export const prerender = true;

/**
 * The same Server Card as `/mcp/server-card`, at the path the agent-readiness
 * scanners look for. The draft explicitly does *not* recommend `.well-known`
 * for a card — that is the catalog's job — but the convention is what tooling
 * checks today, and a second URL for an identical public document costs
 * nothing.
 *
 * Plain `application/json` rather than `application/mcp-server-card+json`:
 * this copy exists for clients that arrived by convention rather than by
 * reading the spec, so it answers with the type they are likeliest to accept.
 * A client that knows the media type should use the reserved location.
 */
export function GET(): Response {
	return new Response(`${JSON.stringify(buildServerCard(), null, 2)}\n`, {
		status: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
