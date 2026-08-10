/**
 * Assumptions for the article importer:
 * - The article is the source of truth for title, slug, summary and tags; the
 *   prompts only supply year, client and industry.
 * - The emitted frontmatter must satisfy the real `projects` Zod schema,
 *   including its exactly-one-client-variant rule.
 * - The body loses its frontmatter and its H1, because the project page renders
 *   the title and summary itself.
 * - Not covered here: the interactive prompts and file writing in
 *   `import-article.ts` (side-effecting orchestrator).
 */

import { parse as parseYaml } from "yaml";
import { projectDataSchema } from "@/projects/schema";
import {
	ArticleImportError,
	articleDefaults,
	buildProjectMarkdown,
	nextProjectOrder,
	parseArticle,
	projectFilePath,
	projectOrder,
	resolveArticlePath,
} from "./import-article-lib";

const ARTICLE = `---
title: "Managing 720+ GPU servers: one view over compute and power"
slug: client-owned-gpu-fleet-crm
year: 2026
sector: distributed GPU compute
stack: [TanStack Start, Hono, Cloudflare Workers, Drizzle ORM, Neon Postgres, Better Auth]
disclosure: anonymised
links: []
kind: launch
---

# Managing 720+ GPU servers: one view over compute and power

## TLDR

A company manages GPU servers for more than 120 owners. The servers are not in a data centre. It runs on Cloudflare Workers against a Postgres database of 45 tables.

## Key facts

- **Scale:** 720 machines
`;

function frontmatterOf(markdown: string): Record<string, unknown> {
	const match = /^---\n([\s\S]*?)\n---\n/.exec(markdown);
	if (!match) throw new Error("generated markdown has no frontmatter block");
	return parseYaml(match[1] ?? "") as Record<string, unknown>;
}

function bodyOf(markdown: string): string {
	return markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
}

describe("parseArticle", () => {
	it("splits frontmatter from body", () => {
		const source = parseArticle(ARTICLE);

		expect(source.frontmatter.slug).toBe("client-owned-gpu-fleet-crm");
		expect(source.frontmatter.stack).toEqual([
			"TanStack Start",
			"Hono",
			"Cloudflare Workers",
			"Drizzle ORM",
			"Neon Postgres",
			"Better Auth",
		]);
		expect(source.body.trimStart().startsWith("# Managing")).toBe(true);
	});

	it("treats a frontmatter-less article as body only", () => {
		const source = parseArticle("# Just a title\n\nSome prose.\n");

		expect(source.frontmatter).toEqual({});
		expect(source.body).toBe("# Just a title\n\nSome prose.\n");
	});

	it("throws ArticleImportError on invalid frontmatter YAML", () => {
		expect(() => parseArticle("---\ntitle: 'unterminated\n---\n\nBody.\n")).toThrow(
			ArticleImportError,
		);
	});
});

describe("articleDefaults", () => {
	it("derives title, slug, year, sector, industry, tags and disclosure from frontmatter", () => {
		const defaults = articleDefaults(parseArticle(ARTICLE), 1999);

		expect(defaults.title).toBe("Managing 720+ GPU servers: one view over compute and power");
		expect(defaults.slug).toBe("client-owned-gpu-fleet-crm");
		expect(defaults.year).toBe(2026);
		expect(defaults.sector).toBe("Distributed GPU compute");
		expect(defaults.industry).toBe("Distributed GPU compute");
		expect(defaults.anonymised).toBe(true);
		expect(defaults.tags).toEqual([
			"TanStack Start",
			"Hono",
			"Cloudflare Workers",
			"Drizzle ORM",
			"Neon Postgres",
			"Better Auth",
		]);
		expect(defaults.links).toEqual([]);
	});

	it("summarises with whole sentences from the TLDR section", () => {
		const defaults = articleDefaults(parseArticle(ARTICLE), 2026);

		expect(defaults.summary).toBe(
			"A company manages GPU servers for more than 120 owners. The servers are not in a data centre.",
		);
	});

	it("prefers a declared summary over the derived one", () => {
		const defaults = articleDefaults(
			parseArticle('---\ntitle: "T"\nsummary: "Declared."\n---\n\n## TLDR\n\nDerived prose.\n'),
			2026,
		);

		expect(defaults.summary).toBe("Declared.");
	});

	it("falls back to the H1 for title and slug, and to the given year", () => {
		const defaults = articleDefaults(
			parseArticle("# Rescuing a Fintech Platform\n\nProse.\n"),
			2024,
		);

		expect(defaults.title).toBe("Rescuing a Fintech Platform");
		expect(defaults.slug).toBe("rescuing-a-fintech-platform");
		expect(defaults.year).toBe(2024);
		expect(defaults.industry).toBeUndefined();
		expect(defaults.anonymised).toBe(false);
	});

	it("infers tags from the prose when the article declares none", () => {
		const defaults = articleDefaults(
			parseArticle("# Audit\n\nA security audit of an Astro site on Cloudflare Workers.\n"),
			2026,
		);

		expect(defaults.tags).toEqual(["Cloudflare Workers", "Astro", "Security audit"]);
	});

	it("keeps at most six tags", () => {
		const defaults = articleDefaults(
			parseArticle(
				'---\ntitle: "T"\nsummary: "S."\nstack: [a, b, c, d, e, f, g, h]\n---\n\nProse.\n',
			),
			2026,
		);

		expect(defaults.tags).toEqual(["a", "b", "c", "d", "e", "f"]);
	});

	it("reads declared links and drops entries without a URL", () => {
		const defaults = articleDefaults(
			parseArticle(
				'---\ntitle: "T"\nsummary: "S."\nlinks:\n  - label: "Site"\n    url: "https://example.com"\n  - label: "Broken"\n---\n\nProse.\n',
			),
			2026,
		);

		expect(defaults.links).toEqual([{ label: "Site", url: "https://example.com" }]);
	});

	it("throws when the article has neither a title nor an H1", () => {
		expect(() => articleDefaults(parseArticle("Just prose.\n"), 2026)).toThrow(ArticleImportError);
	});

	it("throws when no summary can be derived", () => {
		expect(() => articleDefaults(parseArticle("# Title\n\n- only a list\n"), 2026)).toThrow(
			ArticleImportError,
		);
	});
});

describe("projectOrder", () => {
	it.each([
		["order: 4\n", 4],
		["title: x\n", undefined],
		["order: nope\n", undefined],
	])("reads %j as %j", (contents, expected) => {
		expect(projectOrder(contents)).toBe(expected);
	});
});

describe("nextProjectOrder", () => {
	it("returns one past the highest published order", () => {
		expect(nextProjectOrder(["order: 2\n", "order: 6\n", "featured: true\n"])).toBe(7);
	});

	it("starts at one when nothing is ordered", () => {
		expect(nextProjectOrder([])).toBe(1);
		expect(nextProjectOrder(["title: x\n"])).toBe(1);
	});
});

describe("resolveArticlePath", () => {
	it.each([
		["~/notes/article.md", "/home/t/notes/article.md"],
		['"/tmp/my notes/article.md"', "/tmp/my notes/article.md"],
		["/tmp/my\\ notes/article.md", "/tmp/my notes/article.md"],
		["notes/article.md", "/repo/notes/article.md"],
	])("normalises %s", (input, expected) => {
		expect(resolveArticlePath(input, "/repo", "/home/t")).toBe(expected);
	});
});

describe("projectFilePath", () => {
	it("targets the projects collection", () => {
		expect(projectFilePath("/repo", "gpu-fleet")).toBe("/repo/src/content/projects/gpu-fleet.md");
	});
});

describe("buildProjectMarkdown", () => {
	const source = parseArticle(ARTICLE);
	const base = {
		title: "Managing 720+ GPU servers",
		slug: "client-owned-gpu-fleet-crm",
		summary: "A company manages GPU servers for more than 120 owners.",
		industry: "Distributed GPU compute",
		year: 2026,
		tags: ["TanStack Start", "Hono"],
		order: 7,
	};

	it("emits frontmatter the projects schema accepts for anonymised work", () => {
		const markdown = buildProjectMarkdown(source, {
			...base,
			client: { sector: "Distributed GPU compute" },
		});
		const parsed = projectDataSchema.safeParse(frontmatterOf(markdown));

		expect(parsed.success).toBe(true);
		expect(parsed.data).toMatchObject({
			slug: "client-owned-gpu-fleet-crm",
			client: { sector: "Distributed GPU compute" },
			industry: "Distributed GPU compute",
			year: 2026,
			stack: ["TanStack Start", "Hono"],
			featured: false,
			order: 7,
			links: [],
		});
	});

	it("emits frontmatter the projects schema accepts for a named client with links", () => {
		const markdown = buildProjectMarkdown(source, {
			...base,
			client: { name: "Antra", url: "https://antra.one" },
			links: [{ label: "antra.one", url: "https://antra.one" }],
		});
		const parsed = projectDataSchema.safeParse(frontmatterOf(markdown));

		expect(parsed.success).toBe(true);
		expect(parsed.data).toMatchObject({
			client: { name: "Antra", url: "https://antra.one" },
			links: [{ label: "antra.one", url: "https://antra.one" }],
		});
	});

	it("drops the article's frontmatter and H1 from the body", () => {
		const body = bodyOf(buildProjectMarkdown(source, { ...base, client: { sector: "Sector" } }));

		expect(body.trimStart().startsWith("## TLDR")).toBe(true);
		expect(body).not.toContain("# Managing");
		expect(body).not.toContain("disclosure:");
		expect(body.endsWith("\n")).toBe(true);
	});

	it("omits optional industry and links, and empties the stack list", () => {
		const markdown = buildProjectMarkdown(source, {
			title: "T",
			slug: "t",
			summary: "S.",
			client: { sector: "Sector" },
			year: 2026,
			tags: [],
		});

		expect(markdown).toContain("stack: []");
		expect(markdown).not.toContain("industry:");
		expect(markdown).not.toContain("links:");
		expect(markdown).not.toContain("order:");
		expect(projectDataSchema.safeParse(frontmatterOf(markdown)).success).toBe(true);
	});

	it("escapes quotes inside emitted strings", () => {
		const markdown = buildProjectMarkdown(source, {
			...base,
			title: 'The "safe pair of hands" build',
			client: { sector: "Sector" },
		});

		expect(markdown).toContain('title: "The \\"safe pair of hands\\" build"');
		expect(frontmatterOf(markdown).title).toBe('The "safe pair of hands" build');
	});
});
