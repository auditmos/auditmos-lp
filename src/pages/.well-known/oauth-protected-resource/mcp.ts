import { buildProtectedResourceMetadata } from "@/oauth/server";

export const prerender = true;

/**
 * RFC 9728 protected resource metadata: it names `/mcp` as the resource and
 * this site as the authorization server that issues tokens for it.
 *
 * This is the document a `401` from `/mcp` points at through its
 * `WWW-Authenticate` header, so a client that arrives without a credential can
 * find out how to get one without a human reading anything.
 */
export function GET(): Response {
	return new Response(`${JSON.stringify(buildProtectedResourceMetadata(), null, 2)}\n`, {
		status: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
