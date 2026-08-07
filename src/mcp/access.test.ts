/**
 * TDD assumptions for issue #14:
 * - The tested public interface is `authorizeMcpRequest(request, deps)`: one
 *   call that decides which rate-limit tier a caller gets, or refuses.
 * - Both limiters are injected, so the tiers are asserted by which binding was
 *   asked and with what key — not by sending 600 real requests.
 * - Token verification is injected too; the crypto is issue #13's, already
 *   covered at the OAuth module boundary.
 * - Not covered here: the Astro endpoint that maps a decision onto a Response,
 *   and the deployed limiter's eventual consistency (verified by hand).
 */

import { OAUTH_PROTECTED_RESOURCE_PATH } from "@/oauth/server";
import { authorizeMcpRequest, type McpAccessDependencies, type RateLimiter } from "./access";
import { MCP_RATE_LIMIT, MCP_RATE_LIMIT_AUTH } from "./server";

const clientIp = "203.0.113.10";
const clientId = "8f4c0c1e-0d2f-4a6b-9c1a-2b3d4e5f6071";

function limiter(success = true): RateLimiter & { calls: { key: string }[] } {
	const calls: { key: string }[] = [];

	return {
		calls,
		limit: async (options) => {
			calls.push(options);
			return { success };
		},
	};
}

function deps(overrides: Partial<McpAccessDependencies> = {}): McpAccessDependencies {
	return {
		anonymousLimiter: limiter(),
		authenticatedLimiter: limiter(),
		verifyAccessToken: async () => ({ valid: false, reason: "signature" }),
		...overrides,
	};
}

function mcpRequest(headers: Record<string, string> = {}): Request {
	return new Request("https://staging.auditmos.com/mcp", {
		method: "POST",
		headers: { "cf-connecting-ip": clientIp, ...headers },
	});
}

const validToken = async () => ({
	valid: true as const,
	claims: {
		iss: "https://staging.auditmos.com",
		sub: clientId,
		aud: "https://staging.auditmos.com/mcp",
		scope: "read:site",
		iat: 1_700_000_000,
		exp: 1_700_003_600,
	},
});

describe("authorizeMcpRequest", () => {
	it("puts a caller with no credential on the anonymous tier, keyed by IP", async () => {
		const anonymousLimiter = limiter();
		const decision = await authorizeMcpRequest(mcpRequest(), deps({ anonymousLimiter }));

		expect(decision).toEqual({ outcome: "allowed", tier: "anonymous" });
		expect(anonymousLimiter.calls).toEqual([{ key: `mcp:${clientIp}` }]);
	});

	it("puts a caller with a valid token on the authenticated tier, keyed by client", async () => {
		const authenticatedLimiter = limiter();
		const decision = await authorizeMcpRequest(
			mcpRequest({ authorization: "Bearer good-token" }),
			deps({ authenticatedLimiter, verifyAccessToken: validToken }),
		);

		// Keyed by the client that authenticated, not the IP it came from: a
		// credential is the better actor signal, and it is the whole point of
		// having one. Two agents behind one NAT no longer share a bucket.
		expect(decision).toEqual({ outcome: "allowed", tier: "authenticated" });
		expect(authenticatedLimiter.calls).toEqual([{ key: `mcp:client:${clientId}` }]);
	});

	it("never charges an authenticated caller against the anonymous bucket", async () => {
		const anonymousLimiter = limiter();
		await authorizeMcpRequest(
			mcpRequest({ authorization: "Bearer good-token" }),
			deps({ anonymousLimiter, verifyAccessToken: validToken }),
		);

		expect(anonymousLimiter.calls).toEqual([]);
	});

	it.each([
		["a forged token", { valid: false, reason: "signature" } as const],
		["an expired token", { valid: false, reason: "expired" } as const],
	])("refuses %s instead of quietly downgrading it", async (_label, verification) => {
		const anonymousLimiter = limiter();
		const authenticatedLimiter = limiter();
		const decision = await authorizeMcpRequest(
			mcpRequest({ authorization: "Bearer bad-token" }),
			deps({
				anonymousLimiter,
				authenticatedLimiter,
				verifyAccessToken: async () => verification,
			}),
		);

		// Silently serving a broken credential at the anonymous tier is the
		// failure mode worth naming: the client would see 429s it cannot explain
		// and never learn its token is bad.
		expect(decision).toMatchObject({ outcome: "unauthorized" });
		expect(anonymousLimiter.calls).toEqual([]);
		expect(authenticatedLimiter.calls).toEqual([]);
	});

	it("tells a refused caller where to learn how to get a working credential", async () => {
		const decision = await authorizeMcpRequest(
			mcpRequest({ authorization: "Bearer bad-token" }),
			deps(),
		);

		expect(decision).toEqual({
			outcome: "unauthorized",
			// RFC 9728 §5.1 — and on the host that was actually called, so a
			// staging client is not sent to production's metadata.
			challenge: `Bearer error="invalid_token", resource_metadata="https://staging.auditmos.com${OAUTH_PROTECTED_RESOURCE_PATH}"`,
		});
	});

	it("treats an empty bearer token as broken, not as absent", async () => {
		const decision = await authorizeMcpRequest(mcpRequest({ authorization: "Bearer " }), deps());

		expect(decision).toMatchObject({ outcome: "unauthorized" });
	});

	it("ignores an authorization scheme it does not implement", async () => {
		// Only Bearer means anything here. A Basic header is not a broken
		// token — it is a client that has not tried to authenticate at all.
		const decision = await authorizeMcpRequest(
			mcpRequest({ authorization: "Basic Zm9vOmJhcg==" }),
			deps(),
		);

		expect(decision).toEqual({ outcome: "allowed", tier: "anonymous" });
	});

	it("reports the anonymous limit when the anonymous tier is exhausted", async () => {
		const decision = await authorizeMcpRequest(
			mcpRequest(),
			deps({ anonymousLimiter: limiter(false) }),
		);

		expect(decision).toEqual({
			outcome: "rateLimited",
			tier: "anonymous",
			limit: MCP_RATE_LIMIT,
		});
	});

	it("reports the higher limit when the authenticated tier is exhausted", async () => {
		const decision = await authorizeMcpRequest(
			mcpRequest({ authorization: "Bearer good-token" }),
			deps({ authenticatedLimiter: limiter(false), verifyAccessToken: validToken }),
		);

		expect(decision).toEqual({
			outcome: "rateLimited",
			tier: "authenticated",
			limit: MCP_RATE_LIMIT_AUTH,
		});
	});

	it("allows the request when the environment has no limiter bound", async () => {
		// `astro dev` runs no Workers runtime, so there is no binding. Failing
		// open beats blocking local development on a production-only service.
		const decision = await authorizeMcpRequest(mcpRequest(), deps({ anonymousLimiter: undefined }));

		expect(decision).toEqual({ outcome: "allowed", tier: "anonymous" });
	});

	it("allows an anonymous request that arrives with no client IP", async () => {
		const anonymousLimiter = limiter();
		const request = new Request("https://staging.auditmos.com/mcp", { method: "POST" });
		const decision = await authorizeMcpRequest(request, deps({ anonymousLimiter }));

		expect(decision).toEqual({ outcome: "allowed", tier: "anonymous" });
		expect(anonymousLimiter.calls).toEqual([]);
	});
});

describe("the two published limits", () => {
	it("gives an authenticated caller strictly more than an anonymous one", () => {
		// Otherwise registering buys nothing and the whole OAuth surface is
		// ceremony.
		expect(MCP_RATE_LIMIT_AUTH.requests).toBeGreaterThan(MCP_RATE_LIMIT.requests);
	});

	it("uses a window the rate-limit binding can actually express", () => {
		// Cloudflare's `simple.period` accepts only 10 or 60.
		expect([10, 60]).toContain(MCP_RATE_LIMIT.windowSeconds);
		expect([10, 60]).toContain(MCP_RATE_LIMIT_AUTH.windowSeconds);
	});
});
