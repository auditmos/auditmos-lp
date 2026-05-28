import { getCollection } from "astro:content";
import { site } from "@/brand/site";
import { staticPages } from "@/site/pages";

export const prerender = true;

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

export async function GET(): Promise<Response> {
	const projectPaths = (await getCollection("projects")).map(
		(project) => `/projects/${project.data.slug}` as const,
	);
	const urls = [...staticPages.map((page) => page.path), ...projectPaths]
		.map((path) => new URL(path, `${site.url}/`).toString())
		.map((url) => `<url><loc>${escapeXml(url)}</loc></url>`)
		.join("");

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
		{
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
			},
		},
	);
}
