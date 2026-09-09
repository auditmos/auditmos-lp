import { auditReports } from "@/audits/reports";

export { navigationItems } from "@/site/pages";

export const site = {
	name: "Auditmos",
	defaultTitle: "Auditmos: Software Development, Security Audits and R&D",
	defaultDescription: `The independent practice of Tomasz Kowalczyk — software delivery, security audits with ${auditReports.count} public reports, applied R&D.`,
	url: "https://auditmos.com",
	contactEmail: "tom@auditmos.com",
	auditsRepoUrl: "https://github.com/auditmos/audits",
	founder: {
		name: "Tomasz Kowalczyk",
		linkedInUrl: "https://www.linkedin.com/in/kowalczykt/",
		xUrl: "https://x.com/tomkowalczyk",
	},
} as const;

export const brand = {
	accentHex: "#04d9ff",
	fontSans:
		"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
} as const;

export const logoAssets = {
	wordmarkCyan: "/src/assets/logos/auditmos-wordmark-cyan-transparent.svg",
	iconBlack: "/src/assets/logos/auditmos-icon-black.svg",
	iconTransparent: "/src/assets/logos/auditmos-icon-transparent.svg",
	iconWhite: "/src/assets/logos/auditmos-icon-white.svg",
} as const;

/**
 * First 12 hex of `sha256(public/og.png)`, appended to the `og:image` URL.
 *
 * Social platforms cache a scraped image against its URL — LinkedIn for about
 * a week — so regenerating `og.png` in place leaves every share showing the
 * previous card until that expires, and X retired the validator that used to
 * force a refetch. A URL that changes with the bytes makes the next scrape a
 * cache miss on its own.
 *
 * Not derived at runtime: prerendering runs in workerd, which has no `fs`. It
 * is a written constant with `site.test.ts` asserting it against the real file,
 * so regenerating the image without bumping this fails the build rather than
 * silently shipping a stale card URL.
 */
export const OG_IMAGE_VERSION = "5faba9e50d91";

export const legalEntity = {
	name: "Auditmos OÜ",
	registration: "17025406",
	vat: "EE102758111",
	address: "Narva mnt 13-27, 10151 Tallinn, Estonia",
} as const;

export const organizationJsonLd = {
	"@context": "https://schema.org",
	"@type": "Organization",
	"@id": `${site.url}/#organization`,
	name: site.name,
	legalName: legalEntity.name,
	url: site.url,
	identifier: legalEntity.registration,
	vatID: legalEntity.vat,
	// Every profile the site links to belongs here too: `sameAs` is what ties the
	// scattered profiles to one entity for search engines and answer engines.
	sameAs: ["https://github.com/auditmos", site.founder.linkedInUrl, site.founder.xUrl],
	founder: {
		"@type": "Person",
		name: site.founder.name,
		sameAs: [site.founder.linkedInUrl, site.founder.xUrl],
	},
	address: {
		"@type": "PostalAddress",
		streetAddress: "Narva mnt 13-27",
		postalCode: "10151",
		addressLocality: "Tallinn",
		addressCountry: "EE",
	},
	contactPoint: {
		"@type": "ContactPoint",
		contactType: "customer support",
		email: site.contactEmail,
		areaServed: "EU",
		availableLanguage: "en",
	},
} as const;
