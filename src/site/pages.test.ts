/**
 * TDD assumptions for issue #3:
 * - Static content routes are declared through a small exported registry.
 * - Route paths are root-relative and do not include trailing slashes, except "/".
 * - Primary navigation links only to routes that exist in this Phase 2 registry.
 * - This slice does not test page rendering, staging deployment, external OG preview
 *   validation, or browser timing metrics.
 */

import { navigationItems, phaseTwoPages, privacyPage, servicePages } from "./pages";

const requiredRoutes = [
	"/",
	"/software-development",
	"/r-and-d",
	"/security-audits",
	"/about",
	"/privacy",
] as const;

describe("phaseTwoPages", () => {
	it("declares the six Phase 2 static content routes", () => {
		expect(phaseTwoPages.map((page) => page.path).sort()).toEqual([...requiredRoutes].sort());
	});

	it("keeps primary navigation links pointed at declared routes", () => {
		const declaredRoutes = new Set(phaseTwoPages.map((page) => page.path));

		expect(navigationItems.length).toBeGreaterThan(0);
		expect(navigationItems.every((item) => declaredRoutes.has(item.href))).toBe(true);
	});
});

describe("servicePages", () => {
	it("declares unique SEO and Service JSON-LD metadata for each service route", () => {
		expect(servicePages.map((page) => page.path).sort()).toEqual(
			["/software-development", "/r-and-d", "/security-audits"].sort(),
		);

		expect(new Set(servicePages.map((page) => page.title)).size).toBe(servicePages.length);
		expect(new Set(servicePages.map((page) => page.description)).size).toBe(servicePages.length);

		for (const page of servicePages) {
			expect(page.og.title).toBe(page.title);
			expect(page.og.description).toBe(page.description);
			expect(page.jsonLd["@type"]).toBe("Service");
			expect(page.jsonLd.name).toBeTruthy();
			expect(page.jsonLd.description).toBe(page.description);
		}
	});
});

describe("privacyPage", () => {
	it("covers the required contact form, processor, analytics, retention, rights, and contact topics", () => {
		const copy = privacyPage.sections
			.flatMap((section) => [section.heading, ...section.body])
			.join(" ")
			.toLowerCase();

		expect(copy).toContain("contact form");
		expect(copy).toContain("name");
		expect(copy).toContain("email");
		expect(copy).toContain("message");
		expect(copy).toContain("resend");
		expect(copy).toContain("cloudflare turnstile");
		expect(copy).toContain("cloudflare web analytics");
		expect(copy).toContain("no cookies");
		expect(copy).toContain("no pii");
		expect(copy).toContain("retention");
		expect(copy).toContain("access");
		expect(copy).toContain("erasure");
		expect(copy).toContain("contact@auditmos.com");
	});
});
