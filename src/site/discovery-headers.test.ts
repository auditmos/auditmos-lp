import { renderDiscoveryHeaders } from "./discovery-headers";

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
	it("advertises the site-wide agent resources on every path", () => {
		const blocks = headerRuleBlocks(renderDiscoveryHeaders(["/"]));

		expect(blocks.get("/*")).toEqual([
			'Link: </llms.txt>; rel="service-desc"; type="text/plain"; title="Auditmos site index for AI agents"',
			'Link: </agents.json>; rel="service-desc"; type="application/json"; title="Auditmos agent index (DNS-AID)"',
			'Link: </about>; rel="author"',
			'Link: </privacy>; rel="privacy-policy"',
		]);
	});

	it("maps the homepage to /index.md under a single rule", () => {
		const blocks = headerRuleBlocks(renderDiscoveryHeaders(["/"]));

		expect(blocks.get("/")).toEqual([
			'Link: </index.md>; rel="alternate"; type="text/markdown"; title="Markdown twin of this page"',
		]);
		expect(blocks.has("//")).toBe(false);
	});

	it("advertises each page's markdown twin on both the bare and trailing-slash form", () => {
		const blocks = headerRuleBlocks(renderDiscoveryHeaders(["/about", "/projects/rebuild"]));
		const alternate = (target: string) =>
			`Link: <${target}>; rel="alternate"; type="text/markdown"; title="Markdown twin of this page"`;

		expect(blocks.get("/about")).toEqual([alternate("/about.md")]);
		expect(blocks.get("/about/")).toEqual([alternate("/about.md")]);
		expect(blocks.get("/projects/rebuild")).toEqual([alternate("/projects/rebuild.md")]);
		expect(blocks.get("/projects/rebuild/")).toEqual([alternate("/projects/rebuild.md")]);
	});

	it("emits rules in a stable order regardless of the order pages are discovered", () => {
		const routes = ["/", "/about", "/projects/rebuild"];

		expect(renderDiscoveryHeaders([...routes].reverse())).toBe(renderDiscoveryHeaders(routes));
	});

	it("emits only the site-wide rule when no page has a markdown twin", () => {
		expect([...headerRuleBlocks(renderDiscoveryHeaders([])).keys()]).toEqual(["/*"]);
	});
});
