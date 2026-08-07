/**
 * The site states its rate limits in four places: the MCP `initialize`
 * instructions, `/agents.json`, `/auth.md`, and the Server Card. This is the
 * single test that says they must all be the same two numbers.
 *
 * It exists because the failure it prevents is invisible: nothing breaks when a
 * document promises 200 requests and the limiter enforces 120 — the client just
 * gets refused at a number nobody told it, and the site has effectively lied in
 * writing. Issue #14 introduced a second tier, which doubled the surfaces that
 * can drift.
 */

import { renderAuthMarkdown } from "@/oauth/auth-doc";
import { buildAgentIndex } from "./agent-index";
import { MCP_RATE_LIMIT, MCP_RATE_LIMIT_AUTH } from "./server";
import { buildServerCard } from "./server-card";

interface AdvertisedTier {
	requests: number;
	windowSeconds: number;
}

interface AgentIndex {
	agents: {
		rateLimit: AdvertisedTier & { authenticated?: AdvertisedTier };
	}[];
}

const authMarkdown = renderAuthMarkdown();
const agentIndex = buildAgentIndex([]) as AgentIndex;
const serverCard = buildServerCard() as {
	_meta: { "com.auditmos/rateLimit": AdvertisedTier };
};

describe("the published rate limits", () => {
	it("are the same two numbers everywhere the site states them", () => {
		const anonymous = {
			requests: MCP_RATE_LIMIT.requests,
			windowSeconds: MCP_RATE_LIMIT.windowSeconds,
		};
		const authenticated = {
			requests: MCP_RATE_LIMIT_AUTH.requests,
			windowSeconds: MCP_RATE_LIMIT_AUTH.windowSeconds,
		};

		expect(agentIndex.agents[0]?.rateLimit).toMatchObject(anonymous);
		expect(agentIndex.agents[0]?.rateLimit.authenticated).toMatchObject(authenticated);
		expect(serverCard._meta["com.auditmos/rateLimit"]).toMatchObject(anonymous);
	});

	it.each([
		["anonymous", MCP_RATE_LIMIT],
		["authenticated", MCP_RATE_LIMIT_AUTH],
	])("states the %s limit in /auth.md", (_tier, limit) => {
		expect(authMarkdown).toContain(`${limit.requests} requests per ${limit.windowSeconds} seconds`);
	});

	it("never advertises a number that is not one of the two constants", () => {
		// Catches the copy-paste that leaves an old figure behind in prose.
		const advertised = [...authMarkdown.matchAll(/(\d+) requests per (\d+) seconds/g)].map(
			(match) => ({ requests: Number(match[1]), windowSeconds: Number(match[2]) }),
		);

		expect(advertised.length).toBeGreaterThanOrEqual(2);
		for (const tier of advertised) {
			expect([MCP_RATE_LIMIT, MCP_RATE_LIMIT_AUTH]).toContainEqual(tier);
		}
	});
});
