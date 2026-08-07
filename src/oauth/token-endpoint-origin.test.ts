/**
 * Regression test for the bug that only showed up on staging: `POST
 * /oauth/token` answered `403 Cross-site POST form submissions are forbidden`.
 *
 * Astro's `security.checkOrigin` rejects any on-demand POST carrying a
 * form-like content type unless the request's `Origin` header matches the site.
 * RFC 6749 §4.4.2 requires the token request to be
 * `application/x-www-form-urlencoded`, and a token is fetched by a server-side
 * agent, not a browser — so there is no `Origin` header to match and every
 * legitimate client was refused.
 *
 * The guard has to come off, which is safe here only because no route on this
 * site relies on it: `/api/contact` requires a Turnstile token a cross-site
 * form cannot obtain, and `/mcp` runs its own explicit `Origin` allowlist. Any
 * future route that accepts a form body must bring its own check — this test
 * exists so the reasoning is attached to the setting.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const astroConfig = readFileSync(
	resolve(import.meta.dirname, "..", "..", "astro.config.mjs"),
	"utf8",
);
const mcpEndpoint = readFileSync(resolve(import.meta.dirname, "..", "pages", "mcp.ts"), "utf8");
const contactHandler = readFileSync(
	resolve(import.meta.dirname, "..", "contact", "handler.ts"),
	"utf8",
);

describe("astro security config", () => {
	it("does not reject form-encoded POSTs that carry no Origin header", () => {
		// Without this the RFC 6749 token request — form-encoded, sent by a
		// server-side agent with no Origin — is refused before any handler runs.
		expect(astroConfig).toMatch(/security:\s*{[^}]*checkOrigin:\s*false/s);
	});

	it("leaves the MCP endpoint carrying its own origin allowlist", () => {
		// The site-wide guard is gone, so this one has to be real.
		expect(mcpEndpoint).toContain("allowedOrigins");
		expect(mcpEndpoint).toContain("rejectedOrigin");
	});

	it("leaves the contact endpoint gated on a challenge a cross-site form cannot pass", () => {
		expect(contactHandler).toContain("verifyTurnstile");
	});
});
