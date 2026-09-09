/**
 * TDD assumptions for issue #2:
 * - Site identity is static structured data consumed by Astro pages/layouts.
 * - The Phase 1 navigation is a non-empty skeleton with local hrefs only.
 * - Legal footer data is exact text from the issue/PRD.
 * - This slice does not verify real Cloudflare dashboard reporting, Lighthouse,
 *   branch protection, or live staging reachability; those are external checks.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	brand,
	legalEntity,
	logoAssets,
	navigationItems,
	OG_IMAGE_VERSION,
	organizationJsonLd,
	site,
} from "./site";

describe("Open Graph image version", () => {
	it("matches the bytes of the image it is meant to bust the cache for", () => {
		// The constant exists because prerendering runs in workerd and cannot
		// read the file. That makes it the kind of value that rots silently: a
		// regenerated card ships under the old URL, every platform serves its
		// cached copy, and nothing anywhere fails. Hence this test — it is the
		// only thing connecting the number to the file.
		const image = readFileSync(resolve(import.meta.dirname, "..", "..", "public", "og.png"));
		const digest = createHash("sha256").update(image).digest("hex").slice(0, 12);

		expect({ constant: OG_IMAGE_VERSION, ofFile: digest }).toEqual({
			constant: digest,
			ofFile: digest,
		});
	});
});

describe("site identity", () => {
	it("declares the Auditmos brand tokens", () => {
		expect(site.name).toBe("Auditmos");
		expect(site.defaultTitle).toBe("Auditmos: Software Development, Security Audits and R&D");
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
		expect(organizationJsonLd.contactPoint.email).toBe("tom@auditmos.com");
	});

	it("keeps the Phase 2 navigation as local content links", () => {
		expect(navigationItems.length).toBeGreaterThan(0);
		expect(navigationItems.every((item) => item.href.startsWith("/"))).toBe(true);
		expect(navigationItems.map((item) => item.label)).toContain("Security");
	});

	it("exposes the tagline-free SVG wordmark and official icons", () => {
		expect(logoAssets.wordmarkCyan).toBe(
			"/src/assets/logos/auditmos-wordmark-cyan-transparent.svg",
		);
		expect(logoAssets.iconTransparent).toBe("/src/assets/logos/auditmos-icon-transparent.svg");
	});
});
