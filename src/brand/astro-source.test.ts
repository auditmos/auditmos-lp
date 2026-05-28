import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layoutSource = readFileSync(
	resolve(import.meta.dirname, "..", "layouts", "Layout.astro"),
	"utf8",
);
const homeSource = readFileSync(resolve(import.meta.dirname, "..", "pages", "index.astro"), "utf8");

describe("Astro Phase 1 source contract", () => {
	it("keeps the home route prerendered", () => {
		expect(homeSource).toContain("export const prerender = true");
	});

	it("renders the placeholder hero through the shared layout contract", () => {
		expect(homeSource).toContain("Auditmos: Security, Software Development & R&D");
		expect(layoutSource).toContain("legalEntity");
		expect(layoutSource).toContain("navigationItems");
	});

	it("does not add hydrated islands or page scripts", () => {
		expect(`${layoutSource}\n${homeSource}`).not.toMatch(/client:(load|idle|visible|media|only)/);
		expect(homeSource).not.toContain("<script");
	});
});
