/**
 * The tools the Auditmos MCP agent exposes.
 *
 * Every tool answers from data already published on auditmos.com — the same
 * modules the pages, the MD mirror, and `/llms.txt` read. Nothing here reaches
 * the network or invents a capability the site does not have, so an agent that
 * discovers this server via DNS-AID gets the site's facts and nothing more.
 *
 * Read-only by design: the contact form stays human-only because it is gated by
 * a Turnstile challenge an agent cannot solve.
 */

import { auditReports } from "@/audits/reports";
import { legalEntity, site } from "@/brand/site";
import { ossProjects } from "@/oss/projects";
import { getClientDisplay, sortProjects } from "@/projects/index";
import type { ProjectData } from "@/projects/schema";
import { servicePages } from "@/site/pages";
import type { McpTool, McpToolResult } from "./server";

export interface McpProjectEntry {
	data: ProjectData;
	body?: string;
}

function json(value: unknown): McpToolResult {
	return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function problem(message: string): McpToolResult {
	return { content: [{ type: "text", text: message }], isError: true };
}

function summarise(project: ProjectData) {
	return {
		slug: project.slug,
		title: project.title,
		summary: project.summary,
		// Anonymised NDA work exposes a sector instead of a client name; the
		// discriminated union in the schema guarantees exactly one of them.
		client: getClientDisplay(project),
		clientIsNamed: Boolean(project.client.name),
		industry: project.industry,
		year: project.year,
		stack: project.stack,
		featured: project.featured,
		url: `${site.url}/work/${project.slug}`,
		markdownUrl: `${site.url}/work/${project.slug}.md`,
	};
}

export function createSiteTools(projects: readonly McpProjectEntry[]): McpTool[] {
	const ordered = sortProjects(projects);

	return [
		{
			name: "get_company_profile",
			title: "Auditmos company profile",
			description:
				"Legal entity, registration and VAT numbers, address, founder, contact email, " +
				"and the number of published security audit reports. Use this to verify who " +
				"Auditmos is before engaging.",
			inputSchema: { type: "object", properties: {} },
			call: () =>
				json({
					name: site.name,
					legalName: legalEntity.name,
					registration: legalEntity.registration,
					vat: legalEntity.vat,
					address: legalEntity.address,
					url: site.url,
					contactEmail: site.contactEmail,
					founder: site.founder.name,
					founderLinkedIn: site.founder.linkedInUrl,
					founderX: site.founder.xUrl,
					publicAuditReports: auditReports.count,
					publishingAuditReportsSince: auditReports.earliestYear,
					auditReportsRepository: site.auditsRepoUrl,
				}),
		},
		{
			name: "list_services",
			title: "List Auditmos service lines",
			description:
				"The service lines Auditmos sells: software development, security audits, and " +
				"applied R&D, each with its description and page URL.",
			inputSchema: { type: "object", properties: {} },
			call: () =>
				json(
					servicePages.map((service) => ({
						name: service.jsonLd.name,
						description: service.description,
						url: `${site.url}${service.path}`,
						markdownUrl: `${site.url}${service.path}.md`,
						areaServed: service.jsonLd.areaServed,
					})),
				),
		},
		{
			name: "list_projects",
			title: "List Auditmos projects",
			description:
				"Selected Auditmos project history. Named client work exposes the client; " +
				"NDA work exposes only the sector. Optionally filter to featured work.",
			inputSchema: {
				type: "object",
				properties: {
					featuredOnly: {
						type: "boolean",
						description: "Return only projects flagged as featured.",
					},
				},
			},
			call: (args) => {
				const featuredOnly = args.featuredOnly === true;
				const selected = featuredOnly
					? ordered.filter((project) => project.data.featured)
					: ordered;

				return json(selected.map((project) => summarise(project.data)));
			},
		},
		{
			name: "get_project",
			title: "Get one Auditmos project",
			description:
				"Full detail for a single project, including its written case study, by slug. " +
				"Use list_projects first to find slugs.",
			inputSchema: {
				type: "object",
				properties: {
					slug: { type: "string", description: "Project slug, e.g. client-owned-gpu-fleet-crm." },
				},
				required: ["slug"],
			},
			call: (args) => {
				const slug = args.slug;
				if (typeof slug !== "string" || slug.trim() === "") {
					return problem("Provide a project slug. Call list_projects to see the options.");
				}

				const match = ordered.find((project) => project.data.slug === slug);
				if (!match) {
					const known = ordered.map((project) => project.data.slug).join(", ");
					return problem(`No project with slug "${slug}". Known slugs: ${known}`);
				}

				return json({
					...summarise(match.data),
					clientUrl: match.data.client.url,
					links: match.data.links,
					body: match.body ?? "",
				});
			},
		},
		{
			name: "list_open_source",
			title: "List Auditmos open-source repositories",
			description:
				"Public repositories published by Auditmos and its founder, with language and " +
				"star counts as of the last site build.",
			inputSchema: { type: "object", properties: {} },
			call: () =>
				json(
					ossProjects.map((project) => ({
						name: project.fullName,
						description: project.description,
						url: project.url,
						stars: project.stars,
						language: project.language,
						lastUpdated: project.updatedAt,
					})),
				),
		},
	];
}
