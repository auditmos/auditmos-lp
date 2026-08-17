import { API_CATALOG_MEDIA_TYPE, API_CATALOG_PATH, agentSurfaces } from "@/agents/surfaces";
import {
	AI_CATALOG_MEDIA_TYPE,
	AI_CATALOG_PATH,
	SERVER_CARD_MEDIA_TYPE,
	SERVER_CARD_PATH,
	SERVER_CARD_WELL_KNOWN_PATH,
} from "@/mcp/server-card";
import { CSP_HEADER_NAME } from "./content-security-policy";
import { CONTENT_SIGNAL, renderDiscoveryHeaders } from "./discovery-headers";
import { SECURITY_HEADERS } from "./security-headers";

// Parses the Cloudflare `_headers` format: an unindented line opens a rule
// block, the indented lines below it are that block's `Name: value` pairs.
function headerRuleBlocks(headers: string): Map<string, string[]> {
	const blocks = new Map<string, string[]>();
	let currentRules: string[] | undefined;

	for (const line of headers.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		if (/^\s/.test(line)) {
			currentRules?.push(trimmed);
			continue;
		}

		currentRules = blocks.get(trimmed) ?? [];
		blocks.set(trimmed, currentRules);
	}

	return blocks;
}

describe("renderDiscoveryHeaders", () => {
	it("leads the site-wide block with the policy and the API catalog", () => {
		const blocks = headerRuleBlocks(renderDiscoveryHeaders(["/"]));

		// The catalog is the one link that leads to all the others, so it comes
		// first: a client that reads a single relation should read that one.
		expect((blocks.get("/*") ?? []).slice(0, 2)).toEqual([
			"Content-Signal: ai-train=no, search=yes, ai-input=yes",
			`Link: <${API_CATALOG_PATH}>; rel="api-catalog"; type="${API_CATALOG_MEDIA_TYPE}"; title="Auditmos API catalog (every machine-readable surface)"`,
		]);
	});

	it("advertises every registered surface as a Link relation", () => {
		const rules = headerRuleBlocks(renderDiscoveryHeaders(["/"])).get("/*") ?? [];

		// Projected from the registry, not restated here: a surface added there
		// becomes a Link header with no edit to the integration.
		for (const surface of agentSurfaces) {
			expect({ path: surface.path, rules }).toEqual({
				path: surface.path,
				rules: expect.arrayContaining([
					`Link: <${surface.path}>; rel="${surface.relation}"; type="${surface.mediaType}"; title="${surface.title}"`,
				]) as unknown as string[],
			});
		}
	});

	it("keeps the human-facing site-wide relations alongside the agent ones", () => {
		const rules = headerRuleBlocks(renderDiscoveryHeaders(["/"])).get("/*") ?? [];

		expect(rules).toContain('Link: </about>; rel="author"');
		expect(rules).toContain('Link: </privacy>; rel="privacy-policy"');
	});

	it("restates the media types the asset server cannot infer from a filename", () => {
		// A prerendered endpoint's own Response headers do not survive the
		// build. Without these rules `/mcp/server-card` — extensionless by
		// spec — ships with no Content-Type at all.
		const blocks = headerRuleBlocks(renderDiscoveryHeaders([]));

		expect(blocks.get(SERVER_CARD_PATH)).toContain(
			`Content-Type: ${SERVER_CARD_MEDIA_TYPE}; charset=utf-8`,
		);
		expect(blocks.get(AI_CATALOG_PATH)).toContain(
			`Content-Type: ${AI_CATALOG_MEDIA_TYPE}; charset=utf-8`,
		);
		// RFC 9727 reserves an extensionless path, so the asset server has
		// nothing to infer `application/linkset+json` from either.
		expect(blocks.get(API_CATALOG_PATH)).toContain(
			`Content-Type: ${API_CATALOG_MEDIA_TYPE}; charset=utf-8`,
		);
	});

	it("allows cross-origin reads of every MCP discovery document", () => {
		// Browser-based MCP clients fetch these cross-origin; they are public,
		// read-only metadata, which SEP-2127 says is exactly when this is fine.
		const blocks = headerRuleBlocks(renderDiscoveryHeaders([]));

		for (const path of [
			SERVER_CARD_PATH,
			SERVER_CARD_WELL_KNOWN_PATH,
			AI_CATALOG_PATH,
			API_CATALOG_PATH,
		]) {
			expect({ path, rules: blocks.get(path) ?? [] }).toEqual({
				path,
				rules: expect.arrayContaining(["Access-Control-Allow-Origin: *"]) as unknown as string[],
			});
		}
	});

	it("states the content policy on every path, not only where a twin exists", () => {
		// An agent that fetches one asset and never reads robots.txt still gets
		// the policy, so `/*` has to carry it even with no pages generated.
		const blocks = headerRuleBlocks(renderDiscoveryHeaders([]));

		expect(blocks.get("/*")).toContain(`Content-Signal: ${CONTENT_SIGNAL}`);
	});

	it.each([
		"dev",
		"staging",
		undefined,
	])("keeps a %s build out of search engines, site-wide", (cloudflareEnv) => {
		// Preview hosts serve every page as a crawlable duplicate whose
		// canonical points at production — Search Console's "Alternate page
		// with proper canonical tag". Only an explicit production build may
		// omit the noindex, so an unset env fails toward staying unindexed.
		const rules =
			headerRuleBlocks(renderDiscoveryHeaders(["/"], [], cloudflareEnv)).get("/*") ?? [];

		expect(rules).toContain("X-Robots-Tag: noindex");
	});

	it("keeps a production build free of any robots directive", () => {
		// The opposite mistake deindexes the entire site, which is why
		// `pnpm agents:verify` re-checks this against the deployed host.
		expect(renderDiscoveryHeaders(["/"], [], "production")).not.toContain("X-Robots-Tag");
	});

	it("carries the baseline security headers on every path", () => {
		// The values themselves are pinned in security-headers.test.ts; what
		// matters here is that the site-wide block is where they get delivered,
		// so they reach the assets the Worker never sees — `/_astro/*`, `/og.png`,
		// every `.md` twin outside `run_worker_first`.
		const rules = headerRuleBlocks(renderDiscoveryHeaders([])).get("/*") ?? [];

		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			expect(rules).toContain(`${name}: ${value}`);
		}
	});

	it("states one content security policy site-wide, carrying the build's script hashes", () => {
		// One `/*` rule rather than a per-page one. Workers joins repeated header
		// names with a comma, and a comma-separated CSP value is not one policy
		// with more sources — it is two policies, each enforced in full. A
		// page-specific rule would therefore be *intersected* with the site-wide
		// one, and the page would lose every script the site-wide policy omits.
		// The cost is that a hash admitted for one page is admitted for all of
		// them, which is the standard trade for a statically served site.
		const rules = headerRuleBlocks(renderDiscoveryHeaders([], ["AAA=", "BBB="])).get("/*") ?? [];
		const policies = rules.filter((rule) => rule.startsWith(`${CSP_HEADER_NAME}:`));

		expect(policies).toHaveLength(1);
		expect(policies[0]).toContain("'sha256-AAA='");
		expect(policies[0]).toContain("'sha256-BBB='");
	});

	it("maps the homepage to /index.md under a single rule", () => {
		const blocks = headerRuleBlocks(renderDiscoveryHeaders(["/"]));

		expect(blocks.get("/")).toEqual([
			'Link: </index.md>; rel="alternate"; type="text/markdown"; title="Markdown twin of this page"',
		]);
		expect(blocks.has("//")).toBe(false);
	});

	it("advertises each page's markdown twin on both the bare and trailing-slash form", () => {
		const blocks = headerRuleBlocks(renderDiscoveryHeaders(["/about", "/work/rebuild"]));
		const alternate = (target: string) =>
			`Link: <${target}>; rel="alternate"; type="text/markdown"; title="Markdown twin of this page"`;

		expect(blocks.get("/about")).toEqual([alternate("/about.md")]);
		expect(blocks.get("/about/")).toEqual([alternate("/about.md")]);
		expect(blocks.get("/work/rebuild")).toEqual([alternate("/work/rebuild.md")]);
		expect(blocks.get("/work/rebuild/")).toEqual([alternate("/work/rebuild.md")]);
	});

	it("emits rules in a stable order regardless of the order pages are discovered", () => {
		const routes = ["/", "/about", "/work/rebuild"];

		expect(renderDiscoveryHeaders([...routes].reverse())).toBe(renderDiscoveryHeaders(routes));
	});

	it("emits no per-page rule when no page has a markdown twin", () => {
		// The site-wide rule and the fixed media-type rules are unconditional;
		// everything else must be derived from a page that was generated.
		const fixed = new Set([
			"/*",
			API_CATALOG_PATH,
			SERVER_CARD_WELL_KNOWN_PATH,
			...agentSurfaces.map((surface) => surface.path),
		]);
		const patterns = [...headerRuleBlocks(renderDiscoveryHeaders([])).keys()];

		expect(patterns.filter((pattern) => !fixed.has(pattern))).toEqual([]);
		expect(patterns).toContain("/*");
	});
});
