import { buildAuthorizationServerMetadata } from "@/oauth/server";

export const prerender = true;

/**
 * The same RFC 8414 document as `/.well-known/oauth-authorization-server`, at
 * the path OpenID-shaped clients (and the agent-readiness scanners) probe
 * first. Not an OpenID Provider — there is no ID token and no user to
 * authenticate — but the metadata a `client_credentials` client needs is
 * identical either way, and answering both paths removes a guess.
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
