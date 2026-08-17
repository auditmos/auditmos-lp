import { CSP_HEADER_NAME } from "./content-security-policy";
import { ROBOTS_TAG_HEADER_NAME, robotsTagFor, withSecurityHeaders } from "./security-headers";

describe("withSecurityHeaders", () => {
	it("marks the response as not sniffable", () => {
		const secured = withSecurityHeaders(new Response("ok"), "production");

		expect(secured.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});

	it("allows same-origin framing and refuses everyone else", () => {
		// SAMEORIGIN rather than DENY: nothing frames the site today, and DENY
		// would also block same-origin embedding. Turnstile's iframe on /contact
		// is an outbound frame, which this header does not govern either way.
		const secured = withSecurityHeaders(new Response("ok"), "production");

		expect(secured.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
	});

	it("turns the legacy browser XSS auditor off rather than on", () => {
		// `0`, not `1; mode=block`. Safari still ships an auditor whose filtering
		// can introduce vulnerabilities into otherwise sound pages, so the safe
		// value is the one that disables it outright.
		const secured = withSecurityHeaders(new Response("ok"), "production");

		expect(secured.headers.get("X-XSS-Protection")).toBe("0");
	});

	it("gives a Worker-rendered response a policy of its own", () => {
		// `/api/contact`, `/mcp` and the OAuth routes never touch the asset server,
		// so the generated `_headers` cannot reach them. Measured against
		// production on 11 Aug 2026, they carried no CSP at all — which left
		// `frame-ancestors` and `base-uri` unstated on every response the Worker
		// renders itself.
		const secured = withSecurityHeaders(new Response('{"ok":true}'), "production");

		expect(secured.headers.get(CSP_HEADER_NAME)).toContain("frame-ancestors 'self'");
		expect(secured.headers.get(CSP_HEADER_NAME)).toContain("base-uri 'none'");
	});

	it("leaves a page's own hashed policy alone rather than replacing it", () => {
		// Every page route runs through the Worker (`run_worker_first`) but is
		// still answered from its prerendered asset, so it arrives here already
		// carrying the policy `_headers` gave it — including the script hashes,
		// which this module has no way to recompute. Overwriting would refuse
		// every inline script on the site.
		const fromAssetServer = new Response("<html></html>", {
			headers: { [CSP_HEADER_NAME]: "script-src 'self' 'sha256-abc='" },
		});

		expect(withSecurityHeaders(fromAssetServer, "production").headers.get(CSP_HEADER_NAME)).toBe(
			"script-src 'self' 'sha256-abc='",
		);
	});

	it("leaves the response it was handed otherwise intact", async () => {
		// It wraps every response the Worker returns, including the JSON errors
		// from /api/contact and /mcp — so status, body and the headers the route
		// chose have to survive untouched.
		const secured = withSecurityHeaders(
			new Response('{"error":"nope"}', {
				status: 400,
				headers: { "Content-Type": "application/json", "X-Markdown-Tokens": "42" },
			}),
			"production",
		);

		expect(secured.status).toBe(400);
		expect(secured.headers.get("Content-Type")).toBe("application/json");
		expect(secured.headers.get("X-Markdown-Tokens")).toBe("42");
		await expect(secured.text()).resolves.toBe('{"error":"nope"}');
	});

	it("secures a response whose headers are immutable", () => {
		// Anything handed back by `fetch` carries an immutable header guard, and
		// `set` on that guard throws. In production this wraps asset responses
		// fetched through the ASSETS binding, so that is the normal case, not
		// the exotic one.
		const secured = withSecurityHeaders(
			Response.redirect("https://auditmos.com/work", 301),
			"production",
		);

		expect(secured.status).toBe(301);
		expect(secured.headers.get("Location")).toBe("https://auditmos.com/work");
		expect(secured.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});

	it("overwrites an existing value instead of listing it twice", () => {
		// The two delivery surfaces overlap by design: an asset response already
		// carries these from the generated `_headers`, and then passes through
		// here on its way out of the Worker. Appending would emit the header
		// twice, which is how a wrong value gets to survive alongside a right one.
		const secured = withSecurityHeaders(
			new Response("ok", { headers: { "X-Frame-Options": "ALLOWALL" } }),
			"production",
		);

		expect(secured.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
	});

	it("secures a status that is not allowed to carry a body", () => {
		// 304 is a null-body status: handing the Response constructor a body for
		// one throws. A conditional request for any asset produces this.
		const secured = withSecurityHeaders(new Response(null, { status: 304 }), "production");

		expect(secured.status).toBe(304);
		expect(secured.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});

	it.each([
		"dev",
		"staging",
		undefined,
	])("keeps a %s response out of search engines", (cloudflareEnv) => {
		// Staging and the dev Worker serve the same pages as production with
		// canonicals pointing at production — Search Console files each one
		// under "Alternate page with proper canonical tag". Only noindex
		// removes the host from that report; the canonical alone cannot.
		const secured = withSecurityHeaders(new Response("ok"), cloudflareEnv);

		expect(secured.headers.get(ROBOTS_TAG_HEADER_NAME)).toBe("noindex");
	});

	it("never marks a production response noindex", () => {
		// The inverse would deindex the entire site; pnpm agents:verify asserts
		// the same on the deployed host, where the build-time value actually lands.
		const secured = withSecurityHeaders(new Response("ok"), "production");

		expect(secured.headers.get(ROBOTS_TAG_HEADER_NAME)).toBeNull();
	});
});

describe("robotsTagFor", () => {
	it("treats only the explicit production env as indexable", () => {
		// Fail toward noindex: an unset or misspelled env must never make a
		// preview build indexable. The production deploy always stamps the env
		// (scripts/deploy.ts), and agents:verify catches the opposite accident.
		expect(robotsTagFor("production")).toBeUndefined();
		expect(robotsTagFor("staging")).toBe("noindex");
		expect(robotsTagFor("dev")).toBe("noindex");
		expect(robotsTagFor(undefined)).toBe("noindex");
	});
});
