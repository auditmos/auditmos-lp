import {
	handleMcpMessage,
	isSupportedProtocolVersion,
	MCP_PROTOCOL_VERSION,
	MCP_RATE_LIMIT,
	type McpTool,
} from "./server";

const echoTool: McpTool = {
	name: "echo",
	title: "Echo",
	description: "Returns what it was given.",
	inputSchema: {
		type: "object",
		properties: { value: { type: "string" } },
		required: ["value"],
	},
	call: (args) => ({ content: [{ type: "text", text: String(args.value ?? "") }] }),
};

const explodingTool: McpTool = {
	name: "explode",
	title: "Explode",
	description: "Always throws.",
	inputSchema: { type: "object", properties: {} },
	call: () => {
		throw new Error("boom");
	},
};

const tools = [echoTool, explodingTool];

function call(method: string, params?: unknown, id: string | number = 1) {
	return handleMcpMessage({ jsonrpc: "2.0", id, method, params }, tools);
}

describe("handleMcpMessage", () => {
	it("answers initialize with the negotiated protocol version and tool capability", () => {
		const result = call("initialize", { protocolVersion: MCP_PROTOCOL_VERSION });
		const body = result.body as { result: Record<string, unknown> };

		expect(result.status).toBe(200);
		expect(body.result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
		expect(body.result.capabilities).toEqual({ tools: { listChanged: false } });
		expect(body.result.serverInfo).toMatchObject({ name: "auditmos" });
	});

	it("tells clients the rate limit in initialize, matching the enforced constant", () => {
		const body = call("initialize").body as { result: { instructions: string } };

		// An agent that is not told the limit discovers it by being refused.
		expect(body.result.instructions).toContain(`${MCP_RATE_LIMIT.requests} requests`);
		expect(body.result.instructions).toContain(`${MCP_RATE_LIMIT.windowSeconds} seconds`);
		expect(body.result.instructions).toContain("429");
		expect(body.result.instructions).toContain("Retry-After");
	});

	it("echoes a supported protocol version the client asks for, and falls back otherwise", () => {
		const older = call("initialize", { protocolVersion: "2025-03-26" });
		const unknown = call("initialize", { protocolVersion: "1999-01-01" });

		expect((older.body as { result: { protocolVersion: string } }).result.protocolVersion).toBe(
			"2025-03-26",
		);
		expect((unknown.body as { result: { protocolVersion: string } }).result.protocolVersion).toBe(
			MCP_PROTOCOL_VERSION,
		);
	});

	it("lists every registered tool with its input schema", () => {
		const body = call("tools/list").body as {
			result: { tools: { name: string; inputSchema: unknown }[] };
		};

		expect(body.result.tools.map((tool) => tool.name)).toEqual(["echo", "explode"]);
		expect(body.result.tools[0].inputSchema).toEqual(echoTool.inputSchema);
	});

	it("calls a tool and returns its content", () => {
		const body = call("tools/call", { name: "echo", arguments: { value: "hi" } }).body as {
			result: { content: { text: string }[] };
		};

		expect(body.result.content).toEqual([{ type: "text", text: "hi" }]);
	});

	it("reports a throwing tool as a tool error, not a protocol error", () => {
		const body = call("tools/call", { name: "explode" }).body as {
			result: { isError: boolean; content: { text: string }[] };
		};

		expect(body.result.isError).toBe(true);
		expect(body.result.content[0].text).toBe("boom");
	});

	it("rejects an unknown tool and an unknown method as protocol errors", () => {
		const unknownTool = call("tools/call", { name: "nope" }).body as {
			error: { code: number; message: string };
		};
		const unknownMethod = call("resources/list").body as { error: { code: number } };

		expect(unknownTool.error).toEqual({ code: -32602, message: "Unknown tool: nope" });
		expect(unknownMethod.error.code).toBe(-32601);
	});

	it("accepts notifications with 202 and no body", () => {
		const result = handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, tools);

		expect(result).toEqual({ status: 202 });
	});

	it("rejects a malformed envelope with 400", () => {
		expect(handleMcpMessage("not an object", tools).status).toBe(400);
		expect(handleMcpMessage({ jsonrpc: "1.0", id: 1, method: "ping" }, tools).status).toBe(400);
	});

	it("answers ping", () => {
		expect((call("ping").body as { result: unknown }).result).toEqual({});
	});

	it("recognises exactly the protocol versions it implements", () => {
		expect(isSupportedProtocolVersion(MCP_PROTOCOL_VERSION)).toBe(true);
		expect(isSupportedProtocolVersion("2025-03-26")).toBe(true);
		expect(isSupportedProtocolVersion("2024-11-05")).toBe(false);
	});
});
