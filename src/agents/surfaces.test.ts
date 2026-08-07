import { site } from "@/brand/site";
import {
	API_CATALOG_MEDIA_TYPE,
	API_CATALOG_PATH,
	agentSurfaces,
	buildApiCatalog,
} from "./surfaces";

interface LinksetLink {
	href: string;
	type: string;
	title: string;
}

interface LinkContext {
	anchor: string;
	[relation: string]: string | LinksetLink[] | undefined;
}

function catalog(): { linkset: LinkContext[] } {
	return buildApiCatalog() as { linkset: LinkContext[] };
}

function linksOf(context: LinkContext): LinksetLink[] {
	return Object.entries(context)
		.filter(([relation]) => relation !== "anchor")
		.flatMap(([, links]) => (Array.isArray(links) ? links : []));
}

describe("agentSurfaces", () => {
	it("registers every surface with the four fields a projection needs", () => {
		expect(agentSurfaces.length).toBeGreaterThan(0);

		for (const surface of agentSurfaces) {
			expect({ path: surface.path, startsWithSlash: surface.path.startsWith("/") }).toEqual({
				path: surface.path,
				startsWithSlash: true,
			});
			expect(surface.mediaType).not.toBe("");
			expect(surface.title).not.toBe("");
			expect(["service-desc", "service-doc", "service-meta"]).toContain(surface.relation);
		}
	});

	it("registers each surface exactly once", () => {
		const paths = agentSurfaces.map((surface) => surface.path);

		expect([...new Set(paths)]).toEqual(paths);
	});

	it("covers the machine-readable surfaces the site already ships", () => {
		const paths = new Set(agentSurfaces.map((surface) => surface.path));

		expect(paths).toContain("/llms.txt");
		expect(paths).toContain("/agents.json");
		expect(paths).toContain("/.well-known/ai-catalog.json");
		expect(paths).toContain("/mcp/server-card");
		expect(paths).toContain("/sitemap.xml");
	});

	it("does not register the catalog inside itself", () => {
		// The catalog is the index; listing itself as one of the indexed
		// surfaces would make it a self-referential link with no new information.
		expect(agentSurfaces.map((surface) => surface.path)).not.toContain(API_CATALOG_PATH);
	});
});

describe("buildApiCatalog", () => {
	it("is an RFC 9264 linkset with a single context anchored at the site", () => {
		const document = catalog();

		expect(Array.isArray(document.linkset)).toBe(true);
		expect(document.linkset).toHaveLength(1);
		expect(document.linkset[0].anchor).toBe(site.url);
	});

	it("groups every registered surface under its RFC 8288 relation", () => {
		const context = catalog().linkset[0];

		for (const surface of agentSurfaces) {
			const group = context[surface.relation];

			expect({ path: surface.path, group: Array.isArray(group) ? group : [] }).toEqual({
				path: surface.path,
				group: expect.arrayContaining([
					{
						href: `${site.url}${surface.path}`,
						type: surface.mediaType,
						title: surface.title,
					},
				]) as unknown as LinksetLink[],
			});
		}
	});

	it("links nothing the registry does not list", () => {
		// The whole point of the registry: no hand-maintained URL list can drift
		// from it, because the catalog has no URLs of its own.
		const registered = new Set(agentSurfaces.map((surface) => `${site.url}${surface.path}`));
		const linked = linksOf(catalog().linkset[0]).map((link) => link.href);

		expect(linked).toHaveLength(agentSurfaces.length);
		expect(linked.filter((href) => !registered.has(href))).toEqual([]);
	});

	it("serves absolute https URLs, as a linkset href must", () => {
		for (const link of linksOf(catalog().linkset[0])) {
			expect(link.href.startsWith("https://")).toBe(true);
		}
	});

	it("declares the RFC 9727 path and media type", () => {
		expect(API_CATALOG_PATH).toBe("/.well-known/api-catalog");
		expect(API_CATALOG_MEDIA_TYPE).toBe("application/linkset+json");
	});
});
