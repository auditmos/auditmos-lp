/**
 * The Auditmos MCP endpoint — Streamable HTTP transport.
 *
 * The second and last request-time route on the site (see the PRD): MCP is
 * JSON-RPC over HTTP POST, which a prerendered asset cannot serve. All protocol
 * logic lives in `@/mcp/server`; this file only does HTTP.
 */

import { getCollection } from "astro:content";
import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import {
	handleMcpMessage,
	isSupportedProtocolVersion,
	MCP_PROTOCOL_VERSION,
	MCP_RATE_LIMIT,
	RATE_LIMITED_ERROR_CODE,
} from "@/mcp/server";
import { createSiteTools } from "@/mcp/tools";

export const prerender = false;

// The endpoint is unauthenticated, so the client IP is the only actor signal
// available. Cloudflare's guidance prefers a stable user identifier over an IP
// because IPs are shared — but the alternative here is a single global bucket,
// where one abusive caller starves every other client. The limit is set high
// enough that a shared NAT running normal agent sessions will not hit it.
async function withinRateLimit(request: Request): Promise<boolean> {
	const clientIp = request.headers.get("cf-connecting-ip");
	// No binding in `astro dev` (the Workers runtime is not in play) and no IP on
	// a direct local request; fail open rather than block local development.
	if (!clientIp || !env.MCP_RATE_LIMITER) return true;

	const { success } = await env.MCP_RATE_LIMITER.limit({ key: `mcp:${clientIp}` });
	return success;
}

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

	if (!(await withinRateLimit(request))) {
		// A JSON-RPC error body so an MCP client can surface the reason, plus
		// Retry-After so it knows how long to back off without guessing.
		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				id: null,
				error: {
					code: RATE_LIMITED_ERROR_CODE,
					message:
						`Rate limit exceeded: ${MCP_RATE_LIMIT.requests} requests per ` +
						`${MCP_RATE_LIMIT.windowSeconds} seconds. Retry after ` +
						`${MCP_RATE_LIMIT.windowSeconds} seconds.`,
				},
			}),
			{
				status: 429,
				headers: {
					"Content-Type": "application/json",
					"Retry-After": String(MCP_RATE_LIMIT.windowSeconds),
					"MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
					...corsHeaders(origin),
				},
			},
		);
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
