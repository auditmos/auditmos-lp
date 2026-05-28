import type { ProjectData } from "./schema";

export interface ProjectEntry {
	data: ProjectData;
}

export function getClientDisplay(project: ProjectData): string {
	if (project.client.name) return project.client.name;
	return project.client.sector ?? "";
}

function compareProjectData(a: ProjectData, b: ProjectData): number {
	const aHasOrder = a.order !== undefined;
	const bHasOrder = b.order !== undefined;

	if (aHasOrder || bHasOrder) {
		const orderCompare =
			(a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
		if (orderCompare !== 0) return orderCompare;
	}

	const yearCompare = (b.year ?? 0) - (a.year ?? 0);
	if (yearCompare !== 0) return yearCompare;

	const titleCompare = a.title.localeCompare(b.title);
	if (titleCompare !== 0) return titleCompare;

	return a.slug.localeCompare(b.slug);
}

export function sortProjects<T extends ProjectEntry>(projects: readonly T[]): T[] {
	return [...projects].sort((a, b) => compareProjectData(a.data, b.data));
}

export function getFeaturedProjects<T extends ProjectEntry>(
	projects: readonly T[],
	limit = 3,
): T[] {
	return sortProjects(projects.filter((project) => project.data.featured)).slice(0, limit);
}
