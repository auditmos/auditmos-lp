/**
 * TDD assumptions for issue #5:
 * - The MD mirror covers currently implemented site pages only: static content pages,
 *   the projects index, and concrete project detail pages.
 * - `/` maps to `/index.md`; other routes map to `<route>.md`.
 * - Generated/support routes (`/api/*`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`)
 *   and future Phase 5/6 pages are intentionally outside this iteration.
 * - Project content is tested through content-entry-shaped objects so behavior stays
 *   at the public helper boundary rather than Astro internals.
 */

import { auditReports } from "@/audits/reports";
import { MARKDOWN_MEDIA_TYPE, MARKDOWN_TOKENS_HEADER } from "./markdown-negotiation";
import {
	getMarkdownMirrorPages,
	type MarkdownProjectEntry,
	markdownResponse,
	renderLlmsTxt,
} from "./md-mirror";
import { staticPages } from "./pages";

const sampleProjects = [
	{
		body: "Auditmos needed a concise public surface.",
		data: {
			title: "Auditmos Website Rebuild",
			slug: "auditmos-website-rebuild",
			summary: "A static-first rebuild for a trust-focused company website.",
			provenance: "client-work",
			capabilities: ["software"],
			client: { name: "Auditmos OÜ" },
			stack: [],
			featured: true,
			links: [],
		},
	},
] as const satisfies readonly MarkdownProjectEntry[];

const internalProject = {
	body: "The system worked; the market did not respond.",
	data: {
		title: "Measured Product Experiment",
		slug: "measured-product-experiment",
		summary: "An internal experiment with a measured outcome.",
		provenance: "internal-r-and-d",
		capabilities: ["software", "applied-r-and-d"],
		stack: [],
		featured: false,
		links: [],
	},
} as const satisfies MarkdownProjectEntry;

describe("getMarkdownMirrorPages", () => {
	it("enumerates markdown URLs for every static page and project page", () => {
		const pages = getMarkdownMirrorPages(sampleProjects);

		expect(pages.map((page) => page.path).sort()).toEqual(
			[...staticPages.map((page) => page.path), "/work/auditmos-website-rebuild"].sort(),
		);
		expect(pages.find((page) => page.path === "/")?.markdownPath).toBe("/index.md");
		expect(pages.find((page) => page.path === "/software-development")?.markdownPath).toBe(
			"/software-development.md",
		);
		expect(pages.find((page) => page.path === "/work/auditmos-website-rebuild")?.markdownPath).toBe(
			"/work/auditmos-website-rebuild.md",
		);
	});

	it("renders canonical markdown for static pages and raw project bodies with titles prepended", () => {
		const pages = getMarkdownMirrorPages(sampleProjects);

		expect(pages.find((page) => page.path === "/software-development")?.markdown).toContain(
			"Production-ready application slices",
		);
		expect(pages.find((page) => page.path === "/privacy")?.markdown).toContain(
			"## What the contact form collects",
		);
		expect(pages.find((page) => page.path === "/work/auditmos-website-rebuild")?.markdown).toBe(
			"# Auditmos Website Rebuild\n\nProvenance: Client work\nClient: Auditmos OÜ\nCapabilities: Software\n\nAuditmos needed a concise public surface.\n",
		);
	});

	it("renders internal provenance, capabilities and author in project markdown", () => {
		const page = getMarkdownMirrorPages([...sampleProjects, internalProject]).find(
			(candidate) => candidate.path === "/work/measured-product-experiment",
		);

		expect(page?.markdown).toContain("Origin: Internal R&D");
		expect(page?.markdown).toContain("Capabilities: Software, Applied R&D");
		expect(page?.markdown).toContain("Author: Tomasz Kowalczyk");
	});

	it("adds capability-matched related work to the R&D markdown twin", () => {
		const page = getMarkdownMirrorPages([...sampleProjects, internalProject]).find(
			(candidate) => candidate.path === "/r-and-d",
		);

		expect(page?.markdown).toContain("## Related work");
		expect(page?.markdown).toContain("https://auditmos.com/work/measured-product-experiment");
		expect(page?.markdown).not.toContain("https://auditmos.com/work/auditmos-website-rebuild");
	});
});

describe("markdownResponse", () => {
	it("returns text/markdown with utf-8 charset", async () => {
		const response = markdownResponse("# Auditmos\n");

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
		expect(await response.text()).toBe("# Auditmos\n");
	});
});

describe("renderLlmsTxt", () => {
	it("renders the site header block and markdown link index", () => {
		const llmsTxt = renderLlmsTxt(getMarkdownMirrorPages(sampleProjects));

		expect(llmsTxt).toContain(
			`# Auditmos\n\nThe independent practice of Tomasz Kowalczyk — software delivery, security audits with ${auditReports.count} public reports, applied R&D.`,
		);
		expect(llmsTxt).toContain("Contact: tom@auditmos.com");
		expect(llmsTxt).toContain(
			"- [Software Development | Auditmos](https://auditmos.com/software-development.md): Senior software development for reliable systems, internal tools, and product delivery.",
		);
	});

	it("tells agents a page URL negotiates markdown, not just the .md twin", () => {
		const llmsTxt = renderLlmsTxt(getMarkdownMirrorPages(sampleProjects));

		expect(llmsTxt).toContain(`Accept: ${MARKDOWN_MEDIA_TYPE}`);
		expect(llmsTxt).toContain(MARKDOWN_TOKENS_HEADER);
	});

	it("keeps free-form detail above the first H2, which llmstxt.org reserves for link lists", () => {
		const llmsTxt = renderLlmsTxt(getMarkdownMirrorPages(sampleProjects));
		const [preamble = "", ...sections] = llmsTxt.split("\n## ");

		expect(preamble).toContain(`Accept: ${MARKDOWN_MEDIA_TYPE}`);
		// Every line under an H2 is a list item or blank.
		for (const section of sections) {
			for (const line of section.split("\n").slice(1)) {
				expect({ line, listItem: line === "" || line.startsWith("- ") }).toEqual({
					line,
					listItem: true,
				});
			}
		}
	});
});
