/**
 * TDD assumptions for issue #14's documentation half:
 * - The tested interface is `renderAuthMarkdown()`, the prose twin of the OAuth
 *   metadata documents.
 * - Its correctness is not "reads well" but "cannot contradict the machine
 *   surfaces": both rate limits, both endpoint URLs, and the scope come from
 *   the same constants the server enforces.
 * - That every URL it names resolves is asserted against real build output in
 *   `src/site/build-output.test.ts`, not here.
 */

import { MCP_ENDPOINT_PATH, MCP_RATE_LIMIT, MCP_RATE_LIMIT_AUTH } from "@/mcp/server";
import { renderAuthMarkdown } from "./auth-doc";
import {
	AUTH_DOC_PATH,
	OAUTH_AUTHORIZATION_SERVER_PATHS,
	OAUTH_PROTECTED_RESOURCE_PATH,
	OAUTH_REGISTER_PATH,
	OAUTH_SCOPE,
	OAUTH_TOKEN_PATH,
} from "./server";

const markdown = renderAuthMarkdown();

describe("renderAuthMarkdown", () => {
	it("is served from a path that reads as documentation", () => {
		expect(AUTH_DOC_PATH).toBe("/auth.md");
	});

	it("names itself in the H1, which is how tooling identifies the document", () => {
		// The auth.md convention identifies the file by its heading, not only by
		// its path — the readiness scanners parse the H1 and reject a document
		// whose title does not name it. "Authentication at Auditmos" read fine to
		// a human and was invisible to every machine that looked for it.
		const [heading] = markdown.split("\n");

		expect(heading.toLowerCase()).toContain("auth.md");
	});

	it("opens as markdown with a single top-level heading", () => {
		// Fence-aware: the shell snippets carry `#` comments, which are not
		// headings and must not be counted as competing document titles.
		let inCodeFence = false;
		const headings = markdown.split("\n").filter((line) => {
			if (line.startsWith("```")) inCodeFence = !inCodeFence;
			return !inCodeFence && line.startsWith("# ");
		});

		expect(markdown.startsWith("# ")).toBe(true);
		expect(headings).toHaveLength(1);
	});

	it.each([
		"What is public",
		"What a credential buys",
		"How to register",
		"Identity types",
		"Revocation and contact",
		"Every machine-readable surface",
	])("covers the %j section", (heading) => {
		expect(markdown).toContain(`## ${heading}`);
	});

	it("states both rate limits as the numbers the endpoint enforces", () => {
		// The whole reason this document is generated rather than written: a
		// hand-maintained page is one edit away from promising a limit nobody
		// applies.
		expect(markdown).toContain(
			`${MCP_RATE_LIMIT.requests} requests per ${MCP_RATE_LIMIT.windowSeconds}`,
		);
		expect(markdown).toContain(
			`${MCP_RATE_LIMIT_AUTH.requests} requests per ${MCP_RATE_LIMIT_AUTH.windowSeconds}`,
		);
	});

	it.each([
		OAUTH_REGISTER_PATH,
		OAUTH_TOKEN_PATH,
		MCP_ENDPOINT_PATH,
		OAUTH_PROTECTED_RESOURCE_PATH,
		...OAUTH_AUTHORIZATION_SERVER_PATHS,
	])("names %s so a reader can follow it", (path) => {
		expect(markdown).toContain(path);
	});

	it("names the only scope it can issue", () => {
		expect(markdown).toContain(OAUTH_SCOPE);
	});

	it("says plainly that no credential is needed to read anything", () => {
		// The honest headline: this is a public site. A credential raises a
		// ceiling; it does not unlock content, and the document must not let a
		// reader believe otherwise.
		expect(markdown.toLowerCase()).toContain("no credential");
	});

	it("does not promise a grant type the server refuses", () => {
		expect(markdown).not.toContain("authorization_code");
		expect(markdown).toContain("client_credentials");
	});
});
