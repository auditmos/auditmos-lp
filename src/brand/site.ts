export { navigationItems } from "@/site/pages";

export const site = {
	name: "Auditmos",
	defaultTitle: "Auditmos: Software Development, Security Audits & R&D",
	defaultDescription:
		"The independent technical practice of Tomasz Kowalczyk — senior software delivery, security audits with 24 public reports, and applied R&D for EU teams and agencies.",
	url: "https://auditmos.com",
	contactEmail: "contact@auditmos.com",
	auditsRepoUrl: "https://github.com/auditmos/audits",
	founder: {
		name: "Tomasz Kowalczyk",
		linkedInUrl: "https://www.linkedin.com/in/kowalczykt/",
	},
} as const;

export const brand = {
	accentHex: "#04d9ff",
	fontSans:
		"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
} as const;

export const logoAssets = {
	fullLogoBlack: "/src/assets/logos/auditmos-full-logo-black.svg",
	fullLogoTransparent: "/src/assets/logos/auditmos-full-logo-transparent.svg",
	fullLogoWhite: "/src/assets/logos/auditmos-full-logo-white.svg",
	iconBlack: "/src/assets/logos/auditmos-icon-black.svg",
	iconTransparent: "/src/assets/logos/auditmos-icon-transparent.svg",
	iconWhite: "/src/assets/logos/auditmos-icon-white.svg",
} as const;

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
	sameAs: ["https://github.com/auditmos", site.founder.linkedInUrl],
	founder: {
		"@type": "Person",
		name: site.founder.name,
		sameAs: site.founder.linkedInUrl,
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

export function buildCloudflareAnalyticsScript(token: string | undefined): string {
	if (!token) return "";

	const escapedToken = token.replaceAll('"', "&quot;");
	return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${escapedToken}"}' data-token="${escapedToken}"></script>`;
}
