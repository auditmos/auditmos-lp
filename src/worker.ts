/**
 * The deployed Worker entry (`main` in `wrangler.jsonc`).
 *
 * It exists only to wrap the Cloudflare adapter's handler in two request-level
 * rules: trailing-slash canonicalisation, then `Accept: text/markdown` content
 * negotiation. Everything the adapter does is unchanged: prerendered pages
 * still resolve to static assets, and `/mcp` and `/api/contact` still render on
 * demand.
 *
 * Relative import, not the `@/*` alias: this module is the input to the
 * Cloudflare Vite plugin's worker build rather than to Astro's page build.
 */

import astro from "@astrojs/cloudflare/entrypoints/server";
import { canonicalRedirect } from "./site/canonical-url";
import { withMarkdownNegotiation } from "./site/markdown-negotiation";
import { withSecurityHeaders } from "./site/security-headers";

export default {
	async fetch(request, env, context) {
		// Outermost, so it covers every response this Worker returns — including
		// the ones the asset server never sees and `_headers` therefore cannot
		// reach: `/api/contact`, `/mcp`, and the two OAuth routes. It sets rather
		// than appends, so the assets that already carry these from `_headers`
		// come out unchanged.
		return withSecurityHeaders(
			// Before negotiation, so a trailing-slash URL never serves a document —
			// in either representation — from a non-canonical path.
			canonicalRedirect(request) ??
				(await withMarkdownNegotiation(request, env.ASSETS, () =>
					astro.fetch(request, env, context),
				)),
			env.CLOUDFLARE_ENV,
		);
	},
} satisfies ExportedHandler<Env>;
