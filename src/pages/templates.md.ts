import type { APIRoute } from "astro";
import templatesGuide from "../../docs/templates.md?raw";

export const prerender = true;

// Standalone document, without an HTML twin. Keep docs/ as the only source.
export const GET: APIRoute = () =>
	new Response(templatesGuide, {
		status: 200,
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
		},
	});
