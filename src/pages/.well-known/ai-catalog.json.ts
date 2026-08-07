import { AI_CATALOG_MEDIA_TYPE, buildAiCatalog } from "@/mcp/server-card";

export const prerender = true;

/**
 * The AI Catalog — domain-level discovery for this host. This *is* site-wide
 * metadata, so unlike the Server Card it belongs under `.well-known`, and the
 * SEP-2127 draft says so explicitly.
 *
 * It carries no human-readable copy of its own: a client reads `title`,
 * `description`, and `version` from the card it points at, so the two cannot
 * drift apart.
 */
export function GET(): Response {
	return new Response(`${JSON.stringify(buildAiCatalog(), null, 2)}\n`, {
		status: 200,
		headers: {
			"Content-Type": `${AI_CATALOG_MEDIA_TYPE}; charset=utf-8`,
			"Access-Control-Allow-Origin": "*",
		},
	});
}
