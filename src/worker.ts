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

export default {
	fetch(request, env, context) {
		// Before negotiation, so a trailing-slash URL never serves a document —
		// in either representation — from a non-canonical path.
		return (
			canonicalRedirect(request) ??
			withMarkdownNegotiation(request, env.ASSETS, () => astro.fetch(request, env, context))
		);
	},
} satisfies ExportedHandler<Env>;
