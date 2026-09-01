import { auditReports } from "@/audits/reports";
import { legalEntity } from "@/brand/site";
import { servicePages } from "@/site/pages";
import { createSiteTools, type McpProjectEntry } from "./tools";

const namedClientProject = {
	data: {
		title: "Auditmos Website Rebuild",
		slug: "auditmos-website-rebuild",
		summary: "A static-first rebuild for a trust-focused company website.",
		provenance: "client-work",
		capabilities: ["software"],
		client: { name: "Auditmos OÜ" },
		stack: ["Astro"],
		featured: true,
		links: [],
		year: 2026,
	},
	body: "Auditmos needed a concise public surface.",
} as const satisfies McpProjectEntry;

const anonymisedProject = {
	data: {
		title: "Regulated Platform Security Review",
		slug: "regulated-platform-security-review",
		summary: "A security review for a regulated platform.",
		provenance: "client-work",
		capabilities: ["security"],
		client: { sector: "Banking" },
		stack: [],
		featured: false,
		links: [],
		year: 2025,
	},
	body: "Findings were delivered as a procurement-ready report.",
} as const satisfies McpProjectEntry;

const internalProject = {
	data: {
		title: "Measured Product Experiment",
		slug: "measured-product-experiment",
		summary: "An internal experiment with a measured outcome.",
		provenance: "internal-r-and-d",
		capabilities: ["software", "applied-r-and-d"],
		stack: ["Astro"],
		featured: false,
		links: [],
		year: 2026,
	},
	body: "The system worked; the market did not respond.",
} as const satisfies McpProjectEntry;

const projects = [namedClientProject, anonymisedProject, internalProject];

function runTool(name: string, args: Record<string, unknown> = {}) {
	const tool = createSiteTools(projects).find((candidate) => candidate.name === name);
	if (!tool) throw new Error(`No such tool: ${name}`);
	return tool.call(args);
}

function parsed(name: string, args: Record<string, unknown> = {}): unknown {
	const result = runTool(name, args);
	return JSON.parse(result.content[0].text);
}

describe("createSiteTools", () => {
	it("exposes a read-only tool set and no way to mutate anything", () => {
		expect(createSiteTools(projects).map((tool) => tool.name)).toEqual([
			"get_company_profile",
			"list_services",
			"list_projects",
			"get_project",
			"list_open_source",
		]);
	});

	it("reports the company profile from the shared legal-entity source", () => {
		const profile = parsed("get_company_profile") as Record<string, unknown>;

		expect(profile.legalName).toBe(legalEntity.name);
		expect(profile.registration).toBe(legalEntity.registration);
		expect(profile.vat).toBe(legalEntity.vat);
		expect(profile.publicAuditReports).toBe(auditReports.count);
	});

	it("lists every service page the site publishes", () => {
		const services = parsed("list_services") as { url: string }[];

		expect(services).toHaveLength(servicePages.length);
		expect(services.map((service) => service.url)).toEqual(
			servicePages.map((page) => `https://auditmos.com${page.path}`),
		);
	});

	it("exposes the client name for named work and only the sector for NDA work", () => {
		const listed = parsed("list_projects") as {
			slug: string;
			client: string;
			clientIsNamed: boolean;
		}[];
		const named = listed.find((project) => project.slug === namedClientProject.data.slug);
		const anonymised = listed.find((project) => project.slug === anonymisedProject.data.slug);

		expect(named).toMatchObject({ client: "Auditmos OÜ", clientIsNamed: true });
		expect(anonymised).toMatchObject({ client: "Banking", clientIsNamed: false });
	});

	it("exposes internal provenance and capabilities without inventing a client", () => {
		const listed = parsed("list_projects") as Record<string, unknown>[];
		const internal = listed.find((project) => project.slug === internalProject.data.slug);

		expect(internal).toMatchObject({
			provenance: "internal-r-and-d",
			capabilities: ["software", "applied-r-and-d"],
		});
		expect(internal).not.toHaveProperty("client");
		expect(internal).not.toHaveProperty("clientIsNamed");
	});

	it("filters to featured work on request", () => {
		const featured = parsed("list_projects", { featuredOnly: true }) as { slug: string }[];

		expect(featured.map((project) => project.slug)).toEqual([namedClientProject.data.slug]);
	});

	it("returns the case-study body for a known slug", () => {
		const project = parsed("get_project", { slug: anonymisedProject.data.slug }) as {
			body: string;
			markdownUrl: string;
		};

		expect(project.body).toBe(anonymisedProject.body);
		expect(project.markdownUrl).toBe(`https://auditmos.com/work/${anonymisedProject.data.slug}.md`);
	});

	it("returns a tool error naming the known slugs when the slug is unknown or missing", () => {
		const unknown = runTool("get_project", { slug: "nope" });
		const missing = runTool("get_project");

		expect(unknown.isError).toBe(true);
		expect(unknown.content[0].text).toContain(namedClientProject.data.slug);
		expect(missing.isError).toBe(true);
	});
});
