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

import { getMarkdownMirrorPages, markdownResponse, renderLlmsTxt } from "./md-mirror";
import { staticPages } from "./pages";

const sampleProjects = [
	{
		body: "Auditmos needed a concise public surface.",
		data: {
			title: "Auditmos Website Rebuild",
			slug: "auditmos-website-rebuild",
			summary: "A static-first rebuild for a trust-focused company website.",
			client: { name: "Auditmos OÜ" },
			stack: [],
			featured: true,
			links: [],
		},
	},
] as const;

describe("getMarkdownMirrorPages", () => {
	it("enumerates markdown URLs for every static page and project page", () => {
		const pages = getMarkdownMirrorPages(sampleProjects);

		expect(pages.map((page) => page.path).sort()).toEqual(
			[...staticPages.map((page) => page.path), "/projects/auditmos-website-rebuild"].sort(),
		);
		expect(pages.find((page) => page.path === "/")?.markdownPath).toBe("/index.md");
		expect(pages.find((page) => page.path === "/software-development")?.markdownPath).toBe(
			"/software-development.md",
		);
		expect(
			pages.find((page) => page.path === "/projects/auditmos-website-rebuild")?.markdownPath,
		).toBe("/projects/auditmos-website-rebuild.md");
	});

	it("renders canonical markdown for static pages and raw project bodies with titles prepended", () => {
		const pages = getMarkdownMirrorPages(sampleProjects);

		expect(pages.find((page) => page.path === "/software-development")?.markdown).toContain(
			"Production-ready application slices",
		);
		expect(pages.find((page) => page.path === "/privacy")?.markdown).toContain(
			"## What the contact form collects",
		);
		expect(pages.find((page) => page.path === "/projects/auditmos-website-rebuild")?.markdown).toBe(
			"# Auditmos Website Rebuild\n\nAuditmos needed a concise public surface.\n",
		);
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
			"# Auditmos\n\nSenior software development, applied R&D, and security audits for teams that need clear, defensible technical outcomes.",
		);
		expect(llmsTxt).toContain("Contact: contact@auditmos.com");
		expect(llmsTxt).toContain(
			"- [Software Development | Auditmos](https://auditmos.com/software-development.md): Senior software development for reliable systems, internal tools, and product delivery.",
		);
	});
});
