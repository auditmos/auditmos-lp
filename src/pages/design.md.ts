import type { APIRoute } from "astro";
import designGuide from "../../docs/design.md?raw";

export const prerender = true;

// Standalone document, without an HTML twin. Keep docs/ as the only source.
export const GET: APIRoute = () =>
	new Response(designGuide, {
		status: 200,
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
		},
	});
