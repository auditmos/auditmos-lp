import { MCP_PROTOCOL_VERSION, MCP_RATE_LIMIT, MCP_SERVER_INFO } from "./server";
import {
	AI_CATALOG_PATH,
	buildAiCatalog,
	buildServerCard,
	SERVER_CARD_MEDIA_TYPE,
	SERVER_CARD_PATH,
	SERVER_CARD_PATHS,
	SERVER_CARD_WELL_KNOWN_PATH,
} from "./server-card";

interface ServerCard {
	$schema: string;
	name: string;
	version: string;
	description: string;
	title?: string;
	websiteUrl?: string;
	repository?: { url: string; source: string };
	icons?: { src: string; mimeType?: string; sizes?: string[] }[];
	remotes?: {
		type: string;
		url: string;
		supportedProtocolVersions?: string[];
	}[];
	_meta?: Record<string, unknown>;
}

interface AiCatalog {
	specVersion: string;
	entries: { identifier: string; type: string; url?: string; data?: unknown }[];
}

const card = () => buildServerCard() as ServerCard;
const catalog = () => buildAiCatalog() as AiCatalog;

describe("buildServerCard", () => {
	it("declares the versioned v1 card schema the draft pins", () => {
		expect(card().$schema).toBe(
			"https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
		);
	});

	it("names the server in reverse-DNS form with exactly one slash", () => {
		// The schema pattern is ^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+$ — the bare
		// runtime name would be rejected.
		expect(card().name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
		expect(card().name.split("/")).toHaveLength(2);
	});

	it("does not contradict the identity initialize reports", () => {
		// SEP-2127: a card's values must agree with the live handshake. Both
		// read MCP_SERVER_INFO, so this holds by construction — the test is here
		// to fail if someone reintroduces a literal.
		expect(card().name.endsWith(`/${MCP_SERVER_INFO.name}`)).toBe(true);
		expect(card().version).toBe(MCP_SERVER_INFO.version);
		expect(card().title).toBe(MCP_SERVER_INFO.title);
		expect(card().description).toBe(MCP_SERVER_INFO.description);
	});

	it("keeps description within the schema's 100-character cap", () => {
		expect(card().description.length).toBeGreaterThan(0);
		expect(card().description.length).toBeLessThanOrEqual(100);
	});

	it("rejects a version that is a range rather than a version", () => {
		expect(card().version).not.toMatch(/^[\^~>=<]|[x*]$/);
	});

	it("points its streamable-http remote at the live endpoint and protocol", () => {
		const [remote] = card().remotes ?? [];

		expect(remote?.type).toBe("streamable-http");
		expect(remote?.url).toBe("https://auditmos.com/mcp");
		expect(remote?.supportedProtocolVersions).toEqual([MCP_PROTOCOL_VERSION]);
	});

	it("declares no primitives, which the draft excludes on purpose", () => {
		// Tools vary by user, session, and config; a static card stating them
		// invites clients to trust a manifest for access-control decisions.
		const keys = Object.keys(card());

		expect(keys).not.toContain("tools");
		expect(keys).not.toContain("resources");
		expect(keys).not.toContain("prompts");
		expect(keys).not.toContain("capabilities");
	});

	it("publishes the rate limit the endpoint actually enforces", () => {
		expect(card()._meta?.["com.auditmos/rateLimit"]).toMatchObject({
			requests: MCP_RATE_LIMIT.requests,
			windowSeconds: MCP_RATE_LIMIT.windowSeconds,
		});
	});

	it("namespaces every _meta key outside the range reserved for MCP", () => {
		// Any prefix containing `mcp` or `modelcontextprotocol` is reserved.
		for (const key of Object.keys(card()._meta ?? {})) {
			expect({ key, prefix: key.split("/")[0] }).toEqual({ key, prefix: "com.auditmos" });
		}
	});

	it("carries no credentials or private detail, since the card is public", () => {
		const serialized = JSON.stringify(card()).toLowerCase();

		for (const secret of ["authorization", "api_key", "apikey", "token", "secret", "password"]) {
			expect({ secret, present: serialized.includes(secret) }).toEqual({ secret, present: false });
		}
	});

	it("links a repository a reader can actually inspect", () => {
		expect(card().repository).toEqual({
			url: "https://github.com/auditmos/auditmos-lp",
			source: "github",
		});
	});
});

describe("buildAiCatalog", () => {
	it("advertises the card at its reserved location, not the well-known mirror", () => {
		// A client that read the spec should be sent to the spec's address.
		const [entry] = catalog().entries;

		expect(entry?.url).toBe(`https://auditmos.com${SERVER_CARD_PATH}`);
		expect(entry?.url).not.toContain(".well-known");
	});

	it("marks the entry with the server card media type", () => {
		expect(catalog().entries[0]?.type).toBe(SERVER_CARD_MEDIA_TYPE);
	});

	it("uses the domain-anchored urn:air identifier format", () => {
		expect(catalog().entries[0]?.identifier).toMatch(/^urn:air:[^:]+:[^:]+:[^:]+$/);
	});

	it("sets exactly one of url or data per entry", () => {
		for (const entry of catalog().entries) {
			expect({
				id: entry.identifier,
				one: (entry.url === undefined) !== (entry.data === undefined),
			}).toEqual({ id: entry.identifier, one: true });
		}
	});

	it("repeats no human-readable field that would drift from the card", () => {
		const [entry] = catalog().entries;

		expect(Object.keys(entry ?? {}).sort()).toEqual(["identifier", "type", "url"]);
	});

	it("declares the catalog spec version", () => {
		expect(catalog().specVersion).toBe("1.0");
	});
});

describe("server card locations", () => {
	it("reserves the path off the streamable-http endpoint, not the domain root", () => {
		expect(SERVER_CARD_PATH).toBe("/mcp/server-card");
	});

	it("also serves where the readiness scanners look", () => {
		expect(SERVER_CARD_WELL_KNOWN_PATH).toBe("/.well-known/mcp/server-card.json");
	});

	it("keeps the catalog under .well-known, where site-wide metadata belongs", () => {
		expect(AI_CATALOG_PATH).toBe("/.well-known/ai-catalog.json");
	});

	it("lists both card URLs so the build can assert each one was generated", () => {
		expect([...SERVER_CARD_PATHS]).toEqual([SERVER_CARD_PATH, SERVER_CARD_WELL_KNOWN_PATH]);
	});
});
