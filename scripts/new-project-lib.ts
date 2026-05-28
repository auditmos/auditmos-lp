import path from "node:path";

function escapeYamlString(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function slugifyProjectTitle(title: string): string {
	const slug = title
		.trim()
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	if (!slug) throw new Error("Project title must contain at least one letter or number.");
	return slug;
}

export function projectPathForTitle(root: string, title: string): string {
	return path.join(root, "src", "content", "projects", `${slugifyProjectTitle(title)}.md`);
}

export function projectMarkdownTemplate(title: string, year: number): string {
	const escapedTitle = escapeYamlString(title.trim());
	const slug = slugifyProjectTitle(title);

	return `---
title: "${escapedTitle}"
slug: "${slug}"
summary: "TODO: One-sentence project summary."
client:
  sector: "TODO: Sector"
year: ${year}
stack: []
featured: false
---

TODO: Describe the project context, work performed, and outcome.
`;
}
