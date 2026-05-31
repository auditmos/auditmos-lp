export interface SitePage {
	path: "/" | `/${string}`;
	title: string;
	description: string;
}

interface OpenGraphMetadata {
	title: string;
	description: string;
}

interface ServiceJsonLd {
	"@context": "https://schema.org";
	"@type": "Service";
	name: string;
	description: string;
	url: string;
	provider: {
		"@id": string;
	};
	areaServed: string;
}

export interface ServicePage extends SitePage {
	og: OpenGraphMetadata;
	jsonLd: ServiceJsonLd;
}

interface ContentSection {
	heading: string;
	body: readonly string[];
}

interface PrivacyPage extends SitePage {
	sections: readonly ContentSection[];
}

const siteUrl = "https://auditmos.com";
const organizationId = `${siteUrl}/#organization`;

export const homePage = {
	path: "/",
	title: "Auditmos: Security, Software Development & R&D",
	description: "Security, software development, and R&D from Auditmos.",
} as const satisfies SitePage;

export const servicePages = [
	{
		path: "/software-development",
		title: "Software Development | Auditmos",
		description:
			"Senior software development for reliable systems, internal tools, and product delivery.",
		og: {
			title: "Software Development | Auditmos",
			description:
				"Senior software development for reliable systems, internal tools, and product delivery.",
		},
		jsonLd: {
			"@context": "https://schema.org",
			"@type": "Service",
			name: "Software development",
			description:
				"Senior software development for reliable systems, internal tools, and product delivery.",
			url: `${siteUrl}/software-development`,
			provider: { "@id": organizationId },
			areaServed: "European Union",
		},
	},
	{
		path: "/r-and-d",
		title: "R&D Services | Auditmos",
		description:
			"Applied research and development for technical validation, prototypes, and grant work.",
		og: {
			title: "R&D Services | Auditmos",
			description:
				"Applied research and development for technical validation, prototypes, and grant work.",
		},
		jsonLd: {
			"@context": "https://schema.org",
			"@type": "Service",
			name: "R&D services",
			description:
				"Applied research and development for technical validation, prototypes, and grant work.",
			url: `${siteUrl}/r-and-d`,
			provider: { "@id": organizationId },
			areaServed: "European Union",
		},
	},
	{
		path: "/security-audits",
		title: "Security Audits | Auditmos",
		description:
			"Security audits for teams that need actionable findings and procurement-ready reporting.",
		og: {
			title: "Security Audits | Auditmos",
			description:
				"Security audits for teams that need actionable findings and procurement-ready reporting.",
		},
		jsonLd: {
			"@context": "https://schema.org",
			"@type": "Service",
			name: "Security audits",
			description:
				"Security audits for teams that need actionable findings and procurement-ready reporting.",
			url: `${siteUrl}/security-audits`,
			provider: { "@id": organizationId },
			areaServed: "European Union",
		},
	},
] as const satisfies readonly ServicePage[];

export const aboutPage = {
	path: "/about",
	title: "About Auditmos",
	description: "Auditmos OÜ is an Estonia-based software, R&D, and security audit company.",
} as const satisfies SitePage;

export const projectsIndexPage = {
	path: "/projects",
	title: "Projects | Auditmos",
	description:
		"Selected Auditmos software, R&D, and security audit projects, including named and anonymised work.",
} as const satisfies SitePage;

export const privacyPage = {
	path: "/privacy",
	title: "Privacy | Auditmos",
	description:
		"How Auditmos handles contact form data, processors, analytics, retention, and GDPR rights.",
	sections: [
		{
			heading: "What the contact form collects",
			body: [
				"The contact form asks for your name, email address, and message so Auditmos can respond to the inquiry.",
				"Do not include sensitive production credentials, secrets, or special-category personal data in the message.",
			],
		},
		{
			heading: "Processors",
			body: [
				"Resend processes transactional email for contact notifications and confirmation messages.",
				"Cloudflare Turnstile processes anti-spam signals for the contact form.",
			],
		},
		{
			heading: "Analytics",
			body: [
				"Cloudflare Web Analytics is used for aggregate site analytics with no cookies and no PII collected by Auditmos.",
				"Auditmos does not use Google Analytics, advertising pixels, or behavioral retargeting scripts.",
			],
		},
		{
			heading: "Retention",
			body: [
				"Contact form submissions and related email threads are retained only as long as needed to handle the inquiry, vendor review, or resulting business relationship.",
				"Inactive inquiries that do not become active work are reviewed for deletion within 24 months.",
			],
		},
		{
			heading: "Your rights",
			body: [
				"You can request access, correction, or erasure of personal data Auditmos holds about you.",
				"Send data requests to contact@auditmos.com.",
			],
		},
	],
} as const satisfies PrivacyPage;

export const contactPage = {
	path: "/contact",
	title: "Contact Auditmos",
	description: "Contact Auditmos about software development, R&D, or security audit work.",
} as const satisfies SitePage;

export const phaseTwoPages = [
	homePage,
	...servicePages,
	aboutPage,
	privacyPage,
] as const satisfies readonly SitePage[];

export const staticPages = [
	...phaseTwoPages,
	projectsIndexPage,
	contactPage,
] as const satisfies readonly SitePage[];

export const navigationItems = [
	{ label: "Software Development", href: "/software-development" },
	{ label: "R&D", href: "/r-and-d" },
	{ label: "Security Audits", href: "/security-audits" },
	{ label: "Projects", href: "/projects" },
	{ label: "About", href: "/about" },
	{ label: "Contact", href: "/contact" },
	{ label: "Privacy", href: "/privacy" },
] as const;
