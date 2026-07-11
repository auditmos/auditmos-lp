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

	it("renders the Phase 2 home page through the shared layout contract", () => {
		expect(homeSource).toContain("Technical work that stands up to scrutiny");
		expect(layoutSource).toContain("legalEntity");
		expect(layoutSource).toContain("navigationItems");
	});

	it("renders site-wide Organization JSON-LD from the shared layout", () => {
		expect(layoutSource).toContain("organizationJsonLd");
		expect(layoutSource).toContain('type="application/ld+json"');
	});

	it("does not add hydrated islands or page scripts", () => {
		expect(`${layoutSource}\n${homeSource}`).not.toMatch(/client:(load|idle|visible|media|only)/);
		expect(homeSource).not.toContain("<script");
	});
});
