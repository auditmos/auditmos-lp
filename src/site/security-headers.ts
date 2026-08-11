/**
 * Baseline application-security response headers.
 *
 * One source of truth, two delivery surfaces, because neither one reaches every
 * response on its own:
 *
 * - `renderDiscoveryHeaders()` folds these into the site-wide `/*` block of the
 *   generated `_headers`. The asset server applies that to everything it serves
 *   — including the page routes listed in `assets.run_worker_first`, which reach
 *   the Worker but are still answered from their prerendered asset.
 * - `src/worker.ts` wraps its own return value in `withSecurityHeaders()`. That
 *   covers what `_headers` cannot: the responses the Worker renders itself —
 *   `/api/contact`, `/mcp`, the two OAuth routes — which never pass through the
 *   asset server at all. Measured against production on 11 Aug 2026: `/llms.txt`
 *   carried the `_headers` rules, `/mcp` and `/api/contact` carried none.
 *
 * The two surfaces overlap on every asset the Worker proxies, which is why this
 * sets rather than appends: applying it twice must be indistinguishable from
 * applying it once.
 *
 * Runs in the Worker, so nothing here may touch Node — unlike its sibling
 * `discovery-headers.ts`, which is build-time only.
 */

import { CSP_HEADER_NAME, renderContentSecurityPolicy } from "./content-security-policy";

/**
 * `X-Frame-Options: SAMEORIGIN` rather than `DENY`: nothing frames the site
 * today, and `DENY` would also forbid same-origin embedding for no gain.
 * Turnstile's iframe on `/contact` is an *outbound* frame, governed by CSP's
 * `frame-src`, so neither value affects it.
 *
 * `X-XSS-Protection: 0` disables the auditor rather than enabling it. Safari
 * still ships one, and its filtering can introduce vulnerabilities into pages
 * that had none — the header is worth sending precisely to turn that off.
 */
export const SECURITY_HEADERS = {
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "SAMEORIGIN",
	"X-XSS-Protection": "0",
} as const;

/**
 * The response, carrying the baseline headers.
 *
 * Returns a copy: responses handed back by `fetch` — which is every asset
 * response the Worker proxies — have immutable headers, so editing in place
 * throws. Same reason `markdown-negotiation.ts` re-wraps.
 */
export function withSecurityHeaders(response: Response): Response {
	const secured = new Response(response.body, response);

	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		secured.headers.set(name, value);
	}

	// Fills in, rather than sets — the one header here that must not overwrite.
	// An asset response arrives carrying the policy `_headers` gave it, hashes
	// and all, and this fallback has no hashes to offer: overwriting would refuse
	// every inline script on the page. What reaches this branch is what the asset
	// server never saw — the Worker's own JSON responses and canonical redirects,
	// which load nothing and are governed here by `frame-ancestors` and
	// `base-uri` alone.
	if (!secured.headers.has(CSP_HEADER_NAME)) {
		secured.headers.set(CSP_HEADER_NAME, renderContentSecurityPolicy([]));
	}

	return secured;
}
