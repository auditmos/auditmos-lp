import { buildAuthorizationServerMetadata } from "@/oauth/server";

export const prerender = true;

/**
 * RFC 8414 authorization server metadata at the OAuth-reserved path.
 *
 * Byte-identical to `/.well-known/openid-configuration`: both call the same
 * builder with the same serialisation, and a build-output test compares the two
 * files, because a client that probes one path and a client that probes the
 * other must not learn different things about the same server.
 *
 * Extensionless by spec, so the `Content-Type` set here does not survive the
 * build — `_headers` restates it from the surface registry.
 */
export function GET(): Response {
	return new Response(`${JSON.stringify(buildAuthorizationServerMetadata(), null, 2)}\n`, {
		status: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
