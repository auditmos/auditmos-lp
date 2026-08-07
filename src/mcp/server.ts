/**
 * Model Context Protocol server core — stateless Streamable HTTP.
 *
 * Interface is one function: hand it a decoded JSON-RPC message and the tool
 * registry, get back the HTTP status and body to send. Everything else —
 * envelope validation, method dispatch, protocol-version negotiation, tool
 * lookup, error mapping — is internal.
 *
 * Stateless by design: no `Mcp-Session-Id` is issued, which the spec allows
 * (session management is MAY). Every request carries all the context it needs,
 * so the endpoint stays a plain Worker route with no Durable Object behind it.
 */

/** Latest protocol revision this server implements. */
export const MCP_PROTOCOL_VERSION = "2025-06-18";

/**
 * Revisions this server answers on. `2025-03-26` is the version the spec tells
 * servers to assume when a client sends no `MCP-Protocol-Version` header.
 */
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"] as const;

export interface McpRateLimit {
	readonly requests: number;
	readonly windowSeconds: number;
}

/**
 * The published rate limits, one per tier. Each must match its binding in
 * wrangler.jsonc — `MCP_RATE_LIMITER` and `MCP_RATE_LIMITER_AUTH` — and these
 * constants are what the endpoint enforces against, what `initialize` tells
 * clients, what `/agents.json` advertises, and what `/auth.md` documents. A
 * client can never be told a limit different from the one applied.
 *
 * Nothing automated can catch a *binding* drifting from its constant: the
 * limiter is configured in Cloudflare, not in this file. Change the two
 * together and confirm in `dist/server/wrangler.json` after a build.
 */
export const MCP_RATE_LIMIT: McpRateLimit = { requests: 120, windowSeconds: 60 };

/** What registering buys. The reason the OAuth surface exists at all. */
export const MCP_RATE_LIMIT_AUTH: McpRateLimit = { requests: 600, windowSeconds: 60 };

/** Where the server answers. The Server Card's reserved location hangs off it. */
export const MCP_ENDPOINT_PATH = "/mcp";

/**
 * The server's identity, reported by `initialize` and restated by the Server
 * Card. SEP-2127 requires a card not to contradict the runtime handshake, so
 * both read this rather than each spelling the values out.
 *
 * `version` mirrors the protocol version because that is what `serverInfo`
 * has always reported here; it is deliberately not a semver of the site.
 */
export const MCP_SERVER_INFO = {
	name: "auditmos",
	title: "Auditmos",
	version: MCP_PROTOCOL_VERSION,
	// The Server Card schema caps `description` at 100 characters.
	description:
		"Read-only access to the Auditmos company profile, services, projects, and OSS work.",
} as const;

/** JSON-RPC reserves -32000..-32099 for implementation-defined server errors. */
export const RATE_LIMITED_ERROR_CODE = -32000;

export interface McpToolResult {
	content: { type: "text"; text: string }[];
	isError?: boolean;
}

export interface McpTool {
	name: string;
	title: string;
	description: string;
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
	call: (args: Record<string, unknown>) => McpToolResult;
}

export interface McpHttpResult {
	status: number;
	/** Absent for 202 Accepted, which the spec requires to have no body. */
	body?: unknown;
}

const JSON_RPC_VERSION = "2.0";

const errorCodes = {
	invalidRequest: -32600,
	methodNotFound: -32601,
	invalidParams: -32602,
	internalError: -32603,
} as const;

type JsonRpcId = string | number;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
	return typeof value === "string" || typeof value === "number";
}

function success(id: JsonRpcId, result: unknown): McpHttpResult {
	return { status: 200, body: { jsonrpc: JSON_RPC_VERSION, id, result } };
}

function failure(id: JsonRpcId | null, code: number, message: string): McpHttpResult {
	// JSON-RPC errors are transport-level successes: the response carries the
	// fault, so a 200 with an error body is correct unless the envelope itself
	// was unusable.
	return {
		status: id === null ? 400 : 200,
		body: { jsonrpc: JSON_RPC_VERSION, id, error: { code, message } },
	};
}

export function isSupportedProtocolVersion(version: string): boolean {
	return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version);
}

function negotiateProtocolVersion(params: unknown): string {
	const requested = isRecord(params) ? params.protocolVersion : undefined;

	if (typeof requested === "string" && isSupportedProtocolVersion(requested)) {
		return requested;
	}

	return MCP_PROTOCOL_VERSION;
}

function describeTool(tool: McpTool) {
	return {
		name: tool.name,
		title: tool.title,
		description: tool.description,
		inputSchema: tool.inputSchema,
	};
}

function callTool(id: JsonRpcId, params: unknown, tools: readonly McpTool[]): McpHttpResult {
	const name = isRecord(params) ? params.name : undefined;

	if (typeof name !== "string") {
		return failure(id, errorCodes.invalidParams, "Missing tool name");
	}

	const tool = tools.find((candidate) => candidate.name === name);
	if (!tool) {
		return failure(id, errorCodes.invalidParams, `Unknown tool: ${name}`);
	}

	const rawArguments = isRecord(params) ? params.arguments : undefined;
	const args = isRecord(rawArguments) ? rawArguments : {};

	try {
		return success(id, tool.call(args));
	} catch (error) {
		// A throwing tool is a tool-execution failure, not a protocol failure, so
		// it is reported in the result where the model can read and react to it.
		const message = error instanceof Error ? error.message : "Tool execution failed";
		return success(id, { content: [{ type: "text", text: message }], isError: true });
	}
}

export function handleMcpMessage(message: unknown, tools: readonly McpTool[]): McpHttpResult {
	if (!isRecord(message)) {
		return failure(null, errorCodes.invalidRequest, "Request body must be a JSON-RPC object");
	}

	const { jsonrpc, id, method } = message;

	if (jsonrpc !== JSON_RPC_VERSION) {
		return failure(null, errorCodes.invalidRequest, 'Expected "jsonrpc": "2.0"');
	}

	// No id means a notification or a response; the spec requires 202 with no
	// body. `notifications/initialized` is the one that matters in practice.
	if (id === undefined || id === null) {
		return { status: 202 };
	}

	if (!isJsonRpcId(id)) {
		return failure(null, errorCodes.invalidRequest, "id must be a string or a number");
	}

	if (typeof method !== "string") {
		return failure(id, errorCodes.invalidRequest, "Missing method");
	}

	switch (method) {
		case "initialize":
			return success(id, {
				protocolVersion: negotiateProtocolVersion(message.params),
				capabilities: { tools: { listChanged: false } },
				serverInfo: {
					name: MCP_SERVER_INFO.name,
					title: MCP_SERVER_INFO.title,
					version: MCP_SERVER_INFO.version,
				},
				instructions:
					"Read-only access to the Auditmos company profile, service lines, " +
					"selected project history, and published open-source repositories. " +
					"Every tool returns facts published on auditmos.com. " +
					`Rate limit: ${MCP_RATE_LIMIT.requests} requests per ` +
					`${MCP_RATE_LIMIT.windowSeconds} seconds per client IP without a credential, ` +
					`or ${MCP_RATE_LIMIT_AUTH.requests} requests per ` +
					`${MCP_RATE_LIMIT_AUTH.windowSeconds} seconds with one. Registration is open ` +
					"and unauthenticated — see /auth.md. Exceeding either returns HTTP 429 with a " +
					"Retry-After header; wait that many seconds and retry.",
			});
		case "ping":
			return success(id, {});
		case "tools/list":
			return success(id, { tools: tools.map(describeTool) });
		case "tools/call":
			return callTool(id, message.params, tools);
		default:
			return failure(id, errorCodes.methodNotFound, `Unknown method: ${method}`);
	}
}
