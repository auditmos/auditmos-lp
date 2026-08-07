import { buildServerCard, SERVER_CARD_MEDIA_TYPE } from "@/mcp/server-card";

export const prerender = true;

/**
 * The MCP Server Card at its reserved location, `<streamable-http-url>/server-card`.
 * Prerendered: it is static metadata, and a discovery document should not
 * depend on the Worker being warm.
 *
 * Served as `application/mcp-server-card+json`, the media type the draft asks
 * for. The `.well-known` mirror uses plain `application/json` instead — see
 * that endpoint for why.
 */
export function GET(): Response {
	return new Response(`${JSON.stringify(buildServerCard(), null, 2)}\n`, {
		status: 200,
		headers: {
			"Content-Type": `${SERVER_CARD_MEDIA_TYPE}; charset=utf-8`,
			// Public, read-only metadata — the draft calls wide-open CORS
			// acceptable, and browser-based clients need it to read the card.
			"Access-Control-Allow-Origin": "*",
		},
	});
}
