import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layoutSource = readFileSync(
	resolve(import.meta.dirname, "..", "layouts", "Layout.astro"),
	"utf8",
);
const homeSource = readFileSync(resolve(import.meta.dirname, "..", "pages", "index.astro"), "utf8");

describe("Astro static source contract", () => {
	it("keeps the home route prerendered", () => {
		expect(homeSource).toContain("export const prerender = true");
	});

	it("renders the home page through the shared layout contract", () => {
		expect(homeSource).toContain("Read the audits.");
		expect(layoutSource).toContain("legalEntity");
		expect(layoutSource).toContain("navigationItems");
	});

	it("renders site-wide Organization JSON-LD from the shared layout", () => {
		expect(layoutSource).toContain("organizationJsonLd");
		expect(layoutSource).toContain('type="application/ld+json"');
	});

	it("does not add hydrated islands", () => {
		expect(`${layoutSource}\n${homeSource}`).not.toMatch(/client:(load|idle|visible|media|only)/);
	});

	it("adds no homepage-specific script but the inert WebMCP registration", () => {
		// The homepage source adds exactly one `<script>` beyond the shared
		// layout's theme controller: the WebMCP tool registration, which is
		// `is:inline` (never bundled or hydrated) and whose whole body sits behind
		// a feature check no normal browser passes. Anything else here would be a
		// real island arriving by the back door.
		const scripts = [...homeSource.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);

		expect(scripts).toEqual(["<script is:inline set:html={webMcpScript} />"]);
	});
});
