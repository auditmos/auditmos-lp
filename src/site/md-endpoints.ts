import { getCollection } from "astro:content";
import {
	findMarkdownMirrorPage,
	getMarkdownMirrorPages,
	type MarkdownMirrorPage,
	markdownResponse,
	renderLlmsTxt,
} from "./md-mirror";
import type { SitePage } from "./pages";

async function markdownPages(): Promise<MarkdownMirrorPage[]> {
	return getMarkdownMirrorPages(await getCollection("projects"));
}

export async function markdownPageResponse(path: SitePage["path"]): Promise<Response> {
	const page = findMarkdownMirrorPage(await markdownPages(), path);
	return markdownResponse(page.markdown);
}

export async function markdownProjectStaticPaths() {
	return (await markdownPages())
		.filter((page) => page.path.startsWith("/projects/"))
		.map((page) => ({
			params: { slug: page.path.replace("/projects/", "") },
			props: { markdown: page.markdown },
		}));
}

export async function llmsTxtResponse(): Promise<Response> {
	return new Response(renderLlmsTxt(await markdownPages()), {
		status: 200,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
}
