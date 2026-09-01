import {
	getClientDisplay,
	getFeaturedProjects,
	getProjectContext,
	getProjectProvenanceLabel,
	getProjectsByCapability,
	sortProjects,
} from ".";
import type { ProjectData } from "./schema";

function project(overrides: Partial<ProjectData> = {}): { data: ProjectData } {
	const slug = overrides.slug ?? "project";
	const client =
		overrides.provenance === "internal-r-and-d"
			? overrides.client
			: (overrides.client ?? { sector: "R&D" });

	return {
		data: {
			title: overrides.title ?? "Project",
			slug,
			summary: overrides.summary ?? "Project summary.",
			provenance: overrides.provenance ?? "client-work",
			capabilities: overrides.capabilities ?? ["software"],
			client,
			year: overrides.year,
			stack: overrides.stack ?? [],
			links: overrides.links ?? [],
			featured: overrides.featured ?? false,
			order: overrides.order,
		},
	};
}

describe("getClientDisplay", () => {
	it("uses a named client when the public variant is present", () => {
		const project = {
			title: "R&D Prototype",
			slug: "rd-prototype",
			summary: "A prototype for validating a technical bet.",
			provenance: "client-work",
			capabilities: ["software", "applied-r-and-d"],
			client: { name: "Example Labs" },
			stack: [],
			links: [],
			featured: false,
		} satisfies ProjectData;

		expect(getClientDisplay(project)).toBe("Example Labs");
	});

	it("uses a sector descriptor for anonymised projects", () => {
		expect(getClientDisplay(project({ client: { sector: "Banking" } }).data)).toBe("Banking");
	});
});

describe("getProjectContext", () => {
	it("describes internal R&D as its origin instead of a client", () => {
		const context = getProjectContext(
			project({ provenance: "internal-r-and-d", client: undefined }).data,
		);

		expect(context).toEqual({ label: "Origin", value: "Internal R&D" });
	});
});

describe("getProjectProvenanceLabel", () => {
	it("labels client and internal work explicitly", () => {
		expect(getProjectProvenanceLabel(project().data)).toBe("Client work");
		expect(
			getProjectProvenanceLabel(
				project({ provenance: "internal-r-and-d", client: undefined }).data,
			),
		).toBe("Internal R&D");
	});
});

describe("sortProjects", () => {
	it("orders projects by newest year first by default", () => {
		const sorted = sortProjects([
			project({ title: "Older", slug: "older", year: 2024 }),
			project({ title: "Newest", slug: "newest", year: 2026 }),
			project({ title: "Middle", slug: "middle", year: 2025 }),
		]);

		expect(sorted.map((entry) => entry.data.slug)).toEqual(["newest", "middle", "older"]);
	});

	it("uses frontmatter order before default year ordering", () => {
		const sorted = sortProjects([
			project({ title: "Newest", slug: "newest", year: 2026 }),
			project({ title: "Pinned second", slug: "pinned-second", year: 2023, order: 2 }),
			project({ title: "Pinned first", slug: "pinned-first", year: 2022, order: 1 }),
		]);

		expect(sorted.map((entry) => entry.data.slug)).toEqual([
			"pinned-first",
			"pinned-second",
			"newest",
		]);
	});
});

describe("getFeaturedProjects", () => {
	it("filters to featured projects and preserves project ordering", () => {
		const featured = getFeaturedProjects([
			project({ title: "Not featured", slug: "not-featured", year: 2026 }),
			project({ title: "Featured second", slug: "featured-second", featured: true, order: 2 }),
			project({ title: "Featured first", slug: "featured-first", featured: true, order: 1 }),
		]);

		expect(featured.map((entry) => entry.data.slug)).toEqual(["featured-first", "featured-second"]);
	});
});

describe("getProjectsByCapability", () => {
	it("returns an ordered, bounded related-work selection", () => {
		const related = getProjectsByCapability(
			[
				project({ slug: "software-only", capabilities: ["software"], order: 1 }),
				project({
					slug: "r-and-d-second",
					capabilities: ["software", "applied-r-and-d"],
					order: 3,
				}),
				project({ slug: "r-and-d-first", capabilities: ["applied-r-and-d"], order: 2 }),
			],
			"applied-r-and-d",
			1,
		);

		expect(related.map((entry) => entry.data.slug)).toEqual(["r-and-d-first"]);
	});
});
