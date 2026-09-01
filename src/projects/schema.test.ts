/**
 * TDD assumptions for issue #4:
 * - Project frontmatter is validated through a single exported Zod schema.
 * - `client` accepts exactly one confidentiality variant:
 *   `{ name, url? }` for public clients or `{ sector }` for anonymised work.
 * - Internal R&D is a distinct provenance and never invents a client.
 * - Capabilities are explicit, non-empty, and may contain more than one value.
 * - Optional arrays default to empty arrays so rendering code can stay simple.
 * - `year` is numeric and ordering metadata is optional.
 * - This slice does not test Astro's full content loader error text, deployment,
 *   CI timing, or visual page rendering.
 */

import { projectDataSchema } from "./schema";

describe("projectDataSchema", () => {
	it("accepts internal R&D without a client", () => {
		const parsed = projectDataSchema.parse({
			title: "Measured Product Experiment",
			slug: "measured-product-experiment",
			summary: "An internal experiment with a measured outcome.",
			provenance: "internal-r-and-d",
			capabilities: ["software", "applied-r-and-d"],
			year: 2026,
		});

		expect(parsed.provenance).toBe("internal-r-and-d");
		expect(parsed.capabilities).toEqual(["software", "applied-r-and-d"]);
		expect(parsed.client).toBeUndefined();
	});

	it("accepts a named-client project", () => {
		const parsed = projectDataSchema.parse({
			title: "R&D Prototype",
			slug: "rd-prototype",
			summary: "A prototype for validating a technical bet.",
			client: {
				name: "Example Labs",
				url: "https://example.com",
			},
			capabilities: ["software", "applied-r-and-d"],
			year: 2026,
			stack: ["Astro", "Cloudflare"],
			links: [{ label: "Source", url: "https://github.com/auditmos/auditmos-lp" }],
		});

		expect(parsed.client).toEqual({
			name: "Example Labs",
			url: "https://example.com",
		});
	});

	it("accepts an anonymised-sector project", () => {
		const parsed = projectDataSchema.parse({
			title: "Banking Security Review",
			slug: "banking-security-review",
			summary: "An anonymised security audit for a regulated platform.",
			client: {
				sector: "Banking",
			},
			capabilities: ["security"],
			industry: "Financial services",
			year: 2025,
		});

		expect(parsed.client).toEqual({ sector: "Banking" });
		expect(parsed.stack).toEqual([]);
		expect(parsed.links).toEqual([]);
	});

	it("rejects a project that provides both client confidentiality variants", () => {
		const result = projectDataSchema.safeParse({
			title: "Mixed Client Project",
			slug: "mixed-client-project",
			summary: "This frontmatter should not be valid.",
			client: {
				name: "Example Bank",
				sector: "Banking",
			},
			capabilities: ["security"],
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues).toContainEqual(
			expect.objectContaining({
				path: ["client"],
				message: "Provide exactly one of client.name or client.sector.",
			}),
		);
	});

	it("rejects an anonymised-sector project that also provides a client URL", () => {
		const result = projectDataSchema.safeParse({
			title: "Sector With URL",
			slug: "sector-with-url",
			summary: "An anonymised project cannot carry a named-client URL.",
			client: {
				sector: "Banking",
				url: "https://example.com",
			},
			capabilities: ["security"],
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues).toContainEqual(
			expect.objectContaining({
				path: ["client", "url"],
				message: "client.url is only valid when client.name is provided.",
			}),
		);
	});

	it.each([
		[
			"title",
			{
				slug: "missing-title",
				summary: "Missing title.",
				client: { sector: "R&D" },
				capabilities: ["applied-r-and-d"],
			},
		],
		[
			"slug",
			{
				title: "Missing Slug",
				summary: "Missing slug.",
				client: { sector: "R&D" },
				capabilities: ["applied-r-and-d"],
			},
		],
		[
			"summary",
			{
				title: "Missing Summary",
				slug: "missing-summary",
				client: { sector: "R&D" },
				capabilities: ["applied-r-and-d"],
			},
		],
		[
			"client",
			{
				title: "Missing Client",
				slug: "missing-client",
				summary: "Missing client.",
				capabilities: ["software"],
			},
		],
	])("rejects a project missing required field %s", (field, frontmatter) => {
		const result = projectDataSchema.safeParse(frontmatter);

		expect(result.success).toBe(false);
		expect(result.error?.issues.some((issue) => issue.path[0] === field)).toBe(true);
	});

	it.each([
		["missing", undefined],
		["empty", []],
	])("rejects %s capabilities", (_case, capabilities) => {
		const result = projectDataSchema.safeParse({
			title: "Unclassified Project",
			slug: "unclassified-project",
			summary: "A project must be discoverable by capability.",
			client: { sector: "R&D" },
			capabilities,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues.some((issue) => issue.path[0] === "capabilities")).toBe(true);
	});

	it("accepts frontmatter controls for featured projects and custom ordering", () => {
		const parsed = projectDataSchema.parse({
			title: "Featured Project",
			slug: "featured-project",
			summary: "A project pinned into featured slots.",
			client: { sector: "R&D" },
			capabilities: ["applied-r-and-d"],
			featured: true,
			order: 1,
		});

		expect(parsed.featured).toBe(true);
		expect(parsed.order).toBe(1);
	});
});
