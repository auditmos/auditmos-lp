import { API_CATALOG_MEDIA_TYPE, buildApiCatalog } from "@/agents/surfaces";

export const prerender = true;

/**
 * The RFC 9727 API catalog: one fetch that names every machine-readable surface
 * this host publishes, as an RFC 9264 linkset.
 *
 * Extensionless, because RFC 9727 reserves this exact path. That means the
 * asset server cannot infer the media type from the filename and this
 * `Content-Type` does not survive the build — `_headers` restates it, generated
 * by the discovery-headers integration.
 *
 * Every link is projected from the surface registry, so this endpoint holds no
 * URL of its own and cannot drift from what the site actually serves.
 */
export function GET(): Response {
	return new Response(`${JSON.stringify(buildApiCatalog(), null, 2)}\n`, {
		status: 200,
		headers: {
			"Content-Type": `${API_CATALOG_MEDIA_TYPE}; charset=utf-8`,
			// Public, read-only discovery metadata — browser-based agents read it
			// cross-origin, same rationale as the other well-known documents.
			"Access-Control-Allow-Origin": "*",
		},
	});
}
