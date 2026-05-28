import {
	projectMarkdownTemplate,
	projectPathForTitle,
	slugifyProjectTitle,
} from "./new-project-lib";

describe("slugifyProjectTitle", () => {
	it.each([
		["Regulated Platform Security Review", "regulated-platform-security-review"],
		["R&D Prototype 2026", "r-and-d-prototype-2026"],
		["  Multiple   Spaces  ", "multiple-spaces"],
	])("turns %s into %s", (input, expected) => {
		expect(slugifyProjectTitle(input)).toBe(expected);
	});
});

describe("projectMarkdownTemplate", () => {
	it("prefills project frontmatter with title, slug, year, empty stack, and anonymised placeholder", () => {
		const template = projectMarkdownTemplate("Regulated Platform Security Review", 2026);

		expect(template).toContain('title: "Regulated Platform Security Review"');
		expect(template).toContain('slug: "regulated-platform-security-review"');
		expect(template).toContain('summary: "TODO: One-sentence project summary."');
		expect(template).toContain('client:\n  sector: "TODO: Sector"');
		expect(template).toContain("year: 2026");
		expect(template).toContain("stack: []");
	});
});

describe("projectPathForTitle", () => {
	it("returns the markdown path for a title-derived slug", () => {
		expect(projectPathForTitle("/repo", "Regulated Platform Security Review")).toBe(
			"/repo/src/content/projects/regulated-platform-security-review.md",
		);
	});
});
