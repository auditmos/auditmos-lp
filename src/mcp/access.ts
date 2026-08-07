/**
 * Who gets which `/mcp` rate-limit tier.
 *
 * One function decides: hand it the request and the two limiter bindings, get
 * back allowed / rate-limited / unauthorized. The endpoint maps that onto an
 * HTTP response and nothing else; keeping the decision here is what lets the
 * tiers be tested by injection instead of by sending six hundred requests.
 *
 * The rule that matters is the negative one: a present-but-broken credential is
 * refused, never quietly downgraded to the anonymous tier. A client whose token
 * expired mid-session would otherwise see 429s at a fifth of the rate it was
 * promised, with nothing anywhere telling it why.
 *
 * Keys differ by tier on purpose. Anonymous callers are keyed by IP, which is
 * the only actor signal an unauthenticated request carries; authenticated ones
 * are keyed by `client_id`, which is better — two agents behind one NAT stop
 * sharing a bucket the moment either of them registers.
 */

import { type AccessTokenVerification, OAUTH_PROTECTED_RESOURCE_PATH } from "@/oauth/server";
import { MCP_RATE_LIMIT, MCP_RATE_LIMIT_AUTH, type McpRateLimit } from "./server";

/** The shape of a Cloudflare rate-limit binding, narrowed to what is used. */
export interface RateLimiter {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface McpAccessDependencies {
	/** Absent in `astro dev`, where no Workers runtime is in play. */
	anonymousLimiter?: RateLimiter;
	authenticatedLimiter?: RateLimiter;
	verifyAccessToken: (token: string) => Promise<AccessTokenVerification>;
}

type McpTier = "anonymous" | "authenticated";

export type McpAccessDecision =
	| { outcome: "allowed"; tier: McpTier }
	| { outcome: "rateLimited"; tier: McpTier; limit: McpRateLimit }
	| { outcome: "unauthorized"; challenge: string };

/**
 * Returns the token only when the client actually attempted bearer auth. An
 * `Authorization` header in some other scheme is not a broken credential — it
 * is a client that never tried, and it belongs on the anonymous tier.
 *
 * Split on the scheme rather than matched as a prefix, because a header of
 * `Bearer` with nothing after it arrives already trimmed: that is a client that
 * meant to authenticate and sent no credential, which has to read as broken and
 * not as absent.
 */
function bearerToken(request: Request): string | undefined {
	const header = request.headers.get("authorization")?.trim();
	if (!header) return undefined;

	const [scheme, ...credential] = header.split(/\s+/);
	if (scheme?.toLowerCase() !== "bearer") return undefined;

	return credential.join(" ");
}

/**
 * RFC 9728 §5.1: the challenge names the metadata document that says which
 * authorization server issues tokens for this resource — built from the host
 * that was actually called, so a staging client is not sent to production's.
 */
function unauthorizedChallenge(request: Request): string {
	const origin = new URL(request.url).origin;

	return `Bearer error="invalid_token", resource_metadata="${origin}${OAUTH_PROTECTED_RESOURCE_PATH}"`;
}

async function withinLimit(
	limiter: RateLimiter | undefined,
	key: string | undefined,
): Promise<boolean> {
	// No binding (local dev) or no key to charge against: fail open rather than
	// block development on a production-only service.
	if (!limiter || !key) return true;

	return (await limiter.limit({ key })).success;
}

export async function authorizeMcpRequest(
	request: Request,
	deps: McpAccessDependencies,
): Promise<McpAccessDecision> {
	const token = bearerToken(request);

	if (token !== undefined) {
		// An empty bearer token is a client that meant to authenticate and got it
		// wrong, so it is refused rather than treated as absent.
		const verification = token === "" ? undefined : await deps.verifyAccessToken(token);

		if (!verification?.valid) {
			return { outcome: "unauthorized", challenge: unauthorizedChallenge(request) };
		}

		return (await withinLimit(deps.authenticatedLimiter, `mcp:client:${verification.claims.sub}`))
			? { outcome: "allowed", tier: "authenticated" }
			: { outcome: "rateLimited", tier: "authenticated", limit: MCP_RATE_LIMIT_AUTH };
	}

	const clientIp = request.headers.get("cf-connecting-ip");

	return (await withinLimit(deps.anonymousLimiter, clientIp ? `mcp:${clientIp}` : undefined))
		? { outcome: "allowed", tier: "anonymous" }
		: { outcome: "rateLimited", tier: "anonymous", limit: MCP_RATE_LIMIT };
}
