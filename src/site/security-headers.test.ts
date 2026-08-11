import { withSecurityHeaders } from "./security-headers";

describe("withSecurityHeaders", () => {
	it("marks the response as not sniffable", () => {
		const secured = withSecurityHeaders(new Response("ok"));

		expect(secured.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});

	it("allows same-origin framing and refuses everyone else", () => {
		// SAMEORIGIN rather than DENY: nothing frames the site today, and DENY
		// would also block same-origin embedding. Turnstile's iframe on /contact
		// is an outbound frame, which this header does not govern either way.
		const secured = withSecurityHeaders(new Response("ok"));

		expect(secured.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
	});

	it("turns the legacy browser XSS auditor off rather than on", () => {
		// `0`, not `1; mode=block`. Safari still ships an auditor whose filtering
		// can introduce vulnerabilities into otherwise sound pages, so the safe
		// value is the one that disables it outright.
		const secured = withSecurityHeaders(new Response("ok"));

		expect(secured.headers.get("X-XSS-Protection")).toBe("0");
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
		const secured = withSecurityHeaders(Response.redirect("https://auditmos.com/work", 301));

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
		);

		expect(secured.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
	});

	it("secures a status that is not allowed to carry a body", () => {
		// 304 is a null-body status: handing the Response constructor a body for
		// one throws. A conditional request for any asset produces this.
		const secured = withSecurityHeaders(new Response(null, { status: 304 }));

		expect(secured.status).toBe(304);
		expect(secured.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});
});
