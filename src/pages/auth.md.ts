import type { APIRoute } from "astro";
import { renderAuthMarkdown } from "@/oauth/auth-doc";

export const prerender = true;

/**
 * `/auth.md` — the prose twin of the OAuth metadata.
 *
 * Named like an MD-mirror twin but not one: there is no `/auth` HTML page
 * behind it. Authentication has no marketing story worth a page; it has a
 * document an agent reads once and acts on, so markdown is the whole artifact.
 */
export const GET: APIRoute = () =>
	new Response(renderAuthMarkdown(), {
		status: 200,
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
		},
	});
