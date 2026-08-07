/**
 * The Auditmos MCP endpoint — Streamable HTTP transport.
 *
 * The second and last request-time route on the site (see the PRD): MCP is
 * JSON-RPC over HTTP POST, which a prerendered asset cannot serve. All protocol
 * logic lives in `@/mcp/server`; this file only does HTTP.
 */

import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { handleMcpMessage, isSupportedProtocolVersion, MCP_PROTOCOL_VERSION } from "@/mcp/server";
import { createSiteTools } from "@/mcp/tools";

export const prerender = false;

// The spec requires servers to validate Origin to blunt DNS-rebinding attacks.
// Non-browser clients (Claude Desktop, mcp-remote, curl) send no Origin at all,
// which is allowed through; a browser sending someone else's origin is not.
const allowedOrigins = new Set([
	"https://auditmos.com",
	"https://staging.auditmos.com",
	"http://localhost:3000",
	"http://localhost:8788",
]);

function corsHeaders(origin: string | null): Record<string, string> {
	if (!origin || !allowedOrigins.has(origin)) return {};

	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "content-type, mcp-protocol-version, mcp-session-id",
		Vary: "Origin",
	};
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
			...corsHeaders(origin),
		},
	});
}

function rejectedOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	return origin !== null && !allowedOrigins.has(origin);
}

export const POST: APIRoute = async ({ request }) => {
	const origin = request.headers.get("origin");

	if (rejectedOrigin(request)) {
		return jsonResponse({ error: "Origin not allowed" }, 403, null);
	}

	// "If the server receives a request with an invalid or unsupported
	// MCP-Protocol-Version, it MUST respond with 400 Bad Request."
	const requestedVersion = request.headers.get("mcp-protocol-version");
	if (requestedVersion !== null && !isSupportedProtocolVersion(requestedVersion)) {
		return jsonResponse(
			{ error: `Unsupported MCP-Protocol-Version: ${requestedVersion}` },
			400,
			origin,
		);
	}

	let message: unknown;
	try {
		message = await request.json();
	} catch {
		return jsonResponse(
			{ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
			400,
			origin,
		);
	}

	const projects = await getCollection("projects");
	const result = handleMcpMessage(message, createSiteTools(projects));

	if (result.body === undefined) {
		return new Response(null, { status: result.status, headers: corsHeaders(origin) });
	}

	return jsonResponse(result.body, result.status, origin);
};

// The spec lets a server that offers no server-initiated SSE stream answer the
// GET half of the endpoint with 405.
export const GET: APIRoute = () =>
	new Response(
		JSON.stringify({
			error: "This MCP endpoint is stateless. POST JSON-RPC messages here.",
			protocolVersion: MCP_PROTOCOL_VERSION,
		}),
		{ status: 405, headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS" } },
	);

export const OPTIONS: APIRoute = ({ request }) => {
	const origin = request.headers.get("origin");
	return new Response(null, { status: 204, headers: corsHeaders(origin) });
};
