/**
 * The site's Content Security Policy.
 *
 * Runs in the Worker, so nothing here may touch Node — the hashes it is handed
 * are computed by the build integration next door, which is allowed to.
 */

/**
 * Observe first, enforce second.
 *
 * A hand-written policy on a live site is how you find out about the resource
 * nobody remembered — the site's real XSS exposure is low (static-first, no
 * user-generated content rendered into a page), so there is no urgency worth
 * trading a blank homepage for. Flip to `"enforce"` once the report sink has
 * been quiet through a week of production traffic; that is the closing step of
 * issue #30.
 *
 * One mode, one header name, both delivery surfaces. `renderDiscoveryHeaders()`
 * writes the policy into `_headers` for everything the asset server answers,
 * and `withSecurityHeaders()` fills it in on the responses the Worker renders
 * itself. If those two ever used different names, a page would carry the
 * report-only policy *and* an enforcing one it was never validated against.
 */
const CSP_MODE: "report-only" | "enforce" = "report-only";

export const CSP_HEADER_NAME =
	CSP_MODE === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

/** Cloudflare Web Analytics: the beacon, and the host it reports to. */
const ANALYTICS_SCRIPT_ORIGIN = "https://static.cloudflareinsights.com";
const ANALYTICS_REPORT_ORIGIN = "https://cloudflareinsights.com";

/** Turnstile serves the loader script and the challenge iframe from one origin. */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/**
 * Where violation reports land — `src/pages/api/csp-report.ts`.
 *
 * Reached through `report-uri`, which is deprecated and still the only
 * spelling every engine reads. It takes a path resolved against the document,
 * so one static `_headers` file serves dev, staging and production alike;
 * `Reporting-Endpoints` takes a URL, and the only URL a static build could
 * bake in is production's, which would have staging reporting into production.
 * The two cannot be shipped together as a fallback pair either — Chrome
 * ignores `report-uri` outright whenever `report-to` is present.
 */
export const CSP_REPORT_PATH = "/api/csp-report";

/**
 * Script types a browser executes, and therefore checks against `script-src`.
 * Anything else — `application/ld+json`, `text/template` — is a *data block*:
 * HTML's "prepare the script element" returns at the data-block step, before
 * the inline-CSP check runs, so the browser never compares it to a hash.
 * `importmap` is not a data block; the CSP check does run on it.
 */
const EXECUTABLE_SCRIPT_TYPES = new Set([
	"",
	"module",
	"importmap",
	"text/javascript",
	"application/javascript",
	"text/ecmascript",
	"application/ecmascript",
]);

function isExecutable(attributes: string): boolean {
	const type = /\btype\s*=\s*["']?([^"'\s>]*)/i.exec(attributes)?.[1] ?? "";

	return EXECUTABLE_SCRIPT_TYPES.has(type.trim().toLowerCase());
}

/**
 * Every inline script body in a document that a browser will hash and check.
 *
 * The one source of truth for that question: the build integration hashes what
 * this returns, and the build-output test re-derives the same list from the
 * emitted HTML to prove the policy covers all of it.
 */
export function executableInlineScripts(html: string): string[] {
	return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
		.filter(([, attributes = ""]) => !/\bsrc\s*=/i.test(attributes) && isExecutable(attributes))
		.map((match) => match[2] ?? "");
}

/**
 * A base64 SHA-256 digest of an inline script's exact body, as
 * `script-src` spells it.
 */
function hashSource(digest: string): string {
	return `'sha256-${digest}'`;
}

export function renderContentSecurityPolicy(scriptHashes: readonly string[]): string {
	return [
		"default-src 'self'",
		"base-uri 'none'",
		"object-src 'none'",
		[
			"script-src 'self'",
			...scriptHashes.map(hashSource),
			ANALYTICS_SCRIPT_ORIGIN,
			TURNSTILE_ORIGIN,
		].join(" "),
		// `'unsafe-inline'` is not a concession here the way it would be for
		// scripts: Shiki writes its colours into `style` attributes, which hashes
		// do not govern at all, so a hash list would cost header bytes and enforce
		// nothing. CSS injection is also a far narrower primitive than script
		// injection, and `default-src 'self'` still bounds where CSS may load from.
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		`connect-src 'self' ${ANALYTICS_REPORT_ORIGIN}`,
		`frame-src ${TURNSTILE_ORIGIN}`,
		// Kept in step with `X-Frame-Options: SAMEORIGIN` in `security-headers.ts`:
		// modern browsers read this and ignore that header, old ones the reverse.
		"frame-ancestors 'self'",
		"form-action 'self'",
		`report-uri ${CSP_REPORT_PATH}`,
	].join("; ");
}
