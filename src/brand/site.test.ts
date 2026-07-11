/**
 * TDD assumptions for issue #2:
 * - Site identity is static structured data consumed by Astro pages/layouts.
 * - The Phase 1 navigation is a non-empty skeleton with local hrefs only.
 * - Legal footer data is exact text from the issue/PRD.
 * - Analytics script markup is omitted when the token is missing.
 * - This slice does not verify real Cloudflare dashboard reporting, Lighthouse,
 *   branch protection, or live staging reachability; those are external checks.
 */

import {
	brand,
	buildCloudflareAnalyticsScript,
	legalEntity,
	logoAssets,
	navigationItems,
	organizationJsonLd,
	site,
} from "./site";

describe("site identity", () => {
	it("declares the Auditmos brand tokens", () => {
		expect(site.name).toBe("Auditmos");
		expect(site.defaultTitle).toBe("Auditmos: Security, Software Development & R&D");
		expect(brand.accentHex).toBe("#04d9ff");
		expect(brand.fontSans).toContain("system-ui");
	});

	it("declares exact legal footer data", () => {
		expect(legalEntity.name).toBe("Auditmos OÜ");
		expect(legalEntity.registration).toBe("17025406");
		expect(legalEntity.vat).toBe("EE102758111");
		expect(legalEntity.address).toBe("Narva mnt 13-27, 10151 Tallinn, Estonia");
	});

	it("declares site-wide Organization JSON-LD with legal and contact data", () => {
		expect(organizationJsonLd["@type"]).toBe("Organization");
		expect(organizationJsonLd.legalName).toBe("Auditmos OÜ");
		expect(organizationJsonLd.vatID).toBe("EE102758111");
		expect(organizationJsonLd.address.streetAddress).toBe("Narva mnt 13-27");
		expect(organizationJsonLd.contactPoint.email).toBe("contact@auditmos.com");
	});

	it("keeps the Phase 2 navigation as local content links", () => {
		expect(navigationItems.length).toBeGreaterThan(0);
		expect(navigationItems.every((item) => item.href.startsWith("/"))).toBe(true);
		expect(navigationItems.map((item) => item.label)).toContain("Security");
	});

	it("exposes vendored SVG logo lockups and icons", () => {
		expect(logoAssets.fullLogoWhite).toBe("/src/assets/logos/auditmos-full-logo-white.svg");
		expect(logoAssets.iconTransparent).toBe("/src/assets/logos/auditmos-icon-transparent.svg");
	});
});

describe("buildCloudflareAnalyticsScript", () => {
	it("omits analytics markup without a token", () => {
		expect(buildCloudflareAnalyticsScript(undefined)).toBe("");
		expect(buildCloudflareAnalyticsScript("")).toBe("");
	});

	it("renders Cloudflare Web Analytics markup when a token is present", () => {
		const markup = buildCloudflareAnalyticsScript("test-token");

		expect(markup).toContain("https://static.cloudflareinsights.com/beacon.min.js");
		expect(markup).toContain('data-token="test-token"');
		expect(markup).toContain("defer");
	});
});
