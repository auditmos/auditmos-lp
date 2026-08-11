import {
	CSP_HEADER_NAME,
	CSP_REPORT_PATH,
	executableInlineScripts,
	renderContentSecurityPolicy,
} from "./content-security-policy";
import { SECURITY_HEADERS } from "./security-headers";

/** The rendered policy, read back as the directives a browser would parse. */
function directives(policy: string): Map<string, string[]> {
	return new Map(
		policy
			.split(";")
			.map((directive) => directive.trim().split(/\s+/))
			.filter(([name]) => name)
			.map(([name, ...sources]) => [name as string, sources]),
	);
}

describe("renderContentSecurityPolicy", () => {
	it("denies by default and forbids the injection primitives outright", () => {
		// `base-uri 'none'` is the one that matters most next to the script rules:
		// an injected `<base>` retargets every relative URL on the page, which
		// turns a same-origin script allowance into an attacker-controlled one.
		const policy = directives(renderContentSecurityPolicy([]));

		expect(policy.get("default-src")).toEqual(["'self'"]);
		expect(policy.get("base-uri")).toEqual(["'none'"]);
		expect(policy.get("object-src")).toEqual(["'none'"]);
	});

	it("admits an inline script only by the sha-256 of its exact body", () => {
		// Nonces are unavailable to this site: prerendered pages are served as
		// static assets, so there is no per-request render in which to stamp one.
		// Hashes are the remaining option, and `'unsafe-inline'` would void them —
		// a policy carrying both is a policy allowing any inline script at all.
		const policy = directives(renderContentSecurityPolicy(["AAA=", "BBB="]));

		expect(policy.get("script-src")).toEqual(
			expect.arrayContaining(["'self'", "'sha256-AAA='", "'sha256-BBB='"]),
		);
		expect(policy.get("script-src")).not.toContain("'unsafe-inline'");
	});

	it("names the two third parties the site loads, each only where it is used", () => {
		// Cloudflare Web Analytics is injected at the edge, so it appears in no
		// source file and would be the first thing an enforcing policy broke;
		// Turnstile's loader runs on /contact and mounts a cross-origin iframe.
		// Neither gets a blanket allowance: the beacon posts but never frames,
		// the challenge frames but never posts to us.
		const policy = directives(renderContentSecurityPolicy([]));

		expect(policy.get("script-src")).toEqual(
			expect.arrayContaining([
				"https://static.cloudflareinsights.com",
				"https://challenges.cloudflare.com",
			]),
		);
		expect(policy.get("connect-src")).toEqual(["'self'", "https://cloudflareinsights.com"]);
		expect(policy.get("frame-src")).toEqual(["https://challenges.cloudflare.com"]);
	});

	it("accepts inline styles, which no hash could cover anyway", () => {
		// Not the same call as `script-src`: Astro inlines any stylesheet under
		// the asset limit, and Shiki writes its colours into `style` attributes on
		// fenced code. Hashes govern `<style>` elements only — a style *attribute*
		// is reachable by nothing but `'unsafe-inline'`, so hashing the elements
		// would buy a longer header and no enforcement.
		const policy = directives(renderContentSecurityPolicy([]));

		expect(policy.get("style-src")).toEqual(["'self'", "'unsafe-inline'"]);
		// Inlined SVG backgrounds; `data:` here cannot execute, unlike in script-src.
		expect(policy.get("img-src")).toEqual(["'self'", "data:"]);
	});

	it("bounds framing and form posting to this origin, agreeing with X-Frame-Options", () => {
		// A modern browser obeys `frame-ancestors` and ignores `X-Frame-Options`;
		// an old one does the reverse. They therefore have to say the same thing,
		// or the site's clickjacking posture depends on which browser is asking.
		const policy = directives(renderContentSecurityPolicy([]));

		expect(policy.get("frame-ancestors")).toEqual(["'self'"]);
		expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("SAMEORIGIN");
		// The only form on the site posts to `/api/contact`. Pinning this stops an
		// injected `action` from exfiltrating what a visitor typed.
		expect(policy.get("form-action")).toEqual(["'self'"]);
	});

	it("sends violations to the site's own sink", () => {
		// `report-uri` rather than `report-to`, deprecated though it is. It takes a
		// path resolved against the document, so one static `_headers` file serves
		// dev, staging and production; `Reporting-Endpoints` takes a URL, and a
		// build-time absolute one would have staging reporting into production.
		// Chrome ignores `report-uri` whenever `report-to` is present, so the two
		// cannot be shipped side by side as a belt-and-braces pair — a
		// `report-to` group that failed to resolve would silently end reporting
		// for the majority of traffic. Firefox and Safari read only this one.
		const policy = directives(renderContentSecurityPolicy([]));

		expect(policy.get("report-uri")).toEqual([CSP_REPORT_PATH]);
		expect(CSP_REPORT_PATH).toBe("/api/csp-report");
	});
});

describe("CSP_HEADER_NAME", () => {
	it("observes rather than enforces, until a week of real traffic says otherwise", () => {
		// The whole policy is delivered under one header name so that the two
		// surfaces — the generated `_headers` and the Worker's fallback — can never
		// disagree about the mode. Two names in play at once is the failure that
		// matters: a page carrying report-only from `_headers` would then also
		// collect an *enforcing* policy from the Worker, and enforcing a second
		// policy the page was never validated against is a blank page.
		//
		// Flipping this constant is the last step of issue #30, and this assertion
		// is here so that flip is a deliberate edit rather than a silent one.
		expect(CSP_HEADER_NAME).toBe("Content-Security-Policy-Report-Only");
	});
});

describe("executableInlineScripts", () => {
	it("returns the body a browser would hash, whitespace and all", () => {
		// The digest is taken over the exact characters between the tags. Trimming
		// here would produce a hash that matches nothing the browser computes, and
		// the failure mode is a script silently refused rather than an error.
		const body = '\n\t\tconsole.log("hi");\n\t';

		expect(executableInlineScripts(`<body><script>${body}</script></body>`)).toEqual([body]);
	});

	it("passes over a script that loads from a src, which no hash governs", () => {
		// Turnstile's loader on /contact. `script-src` admits it by origin; hashing
		// its empty body would allow every empty inline script on the site instead.
		const html =
			'<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';

		expect(executableInlineScripts(html)).toEqual([]);
	});

	it("passes over a data block, which the browser reads but never executes", () => {
		// Every page ships JSON-LD, several of them more than one block. HTML's
		// "prepare the script element" returns at the data-block step, *before* the
		// "should this inline behaviour be blocked by CSP" check ever runs — so a
		// browser has nothing to compare a hash against. Hashing them anyway would
		// add ~14 unused sources to a header sent on every response, and the
		// report-only phase is what confirms this reading against real browsers.
		const html = `<script type="application/ld+json">{"@type":"Organization"}</script>
			<script type="text/template"><p>not script</p></script>`;

		expect(executableInlineScripts(html)).toEqual([]);
	});

	it("hashes the executable script types, however they are spelled", () => {
		const html = `<script type="module">a()</script>
			<script type="text/javascript">b()</script>
			<script type="importmap">{"imports":{}}</script>`;

		// An import map is not a data block: `determine the script type` names it,
		// so the CSP check does run on it.
		expect(executableInlineScripts(html)).toEqual(["a()", "b()", '{"imports":{}}']);
	});
});
