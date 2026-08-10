/**
 * Trailing-slash normalisation for the URLs the asset server never gets to
 * normalise itself.
 *
 * The site declares slash-free URLs canonical, enforced by `trailingSlash:
 * "never"` (astro.config.mjs) and `assets.html_handling:
 * "drop-trailing-slash"` (wrangler.jsonc). The second one only applies to
 * requests the asset server answers — and `assets.run_worker_first` routes
 * every page route to the Worker first, where the adapter resolves a
 * prerendered route straight to the file backing it. `/work/<slug>/` therefore
 * used to answer 200 with the page body: a second reachable URL for the same
 * document, which is exactly what a canonical URL exists to prevent.
 *
 * Running this ahead of everything else in `src/worker.ts` closes that gap for
 * every path the Worker sees, including the `/work/*` wildcard the asset
 * server's own rule cannot reach.
 */

/**
 * 301, not 302/307: the slash-free URL is canonical permanently, and only a
 * permanent redirect consolidates ranking signals onto it rather than leaving
 * both URLs indexable.
 */
const PERMANENT_REDIRECT = 301;

/**
 * A permanent redirect is safe to cache, and caching it keeps crawlers and
 * repeat visitors off the origin for a URL whose answer cannot change.
 */
const CACHE_CONTROL = "public, max-age=3600";

/**
 * The canonical, slash-free form of `pathname`, or `null` when it is already
 * canonical. The site root is canonical *with* its slash.
 */
function canonicalPathname(pathname: string): string | null {
	if (!pathname.endsWith("/") || pathname === "/") return null;

	const canonical = pathname.replace(/\/+$/, "");
	// `//` and friends collapse to nothing; the root is the only sound target.
	return canonical === "" ? "/" : canonical;
}

/**
 * The redirect a non-canonical URL deserves, or `undefined` when the request
 * should be handled normally.
 *
 * Read-only methods only. A client may turn a 301 into a GET, so redirecting a
 * POST would silently drop the body of a `/api/contact` or `/mcp` call; those
 * pass through untouched and their own routing answers them.
 */
export function canonicalRedirect(request: Request): Response | undefined {
	if (request.method !== "GET" && request.method !== "HEAD") return undefined;

	const url = new URL(request.url);
	const canonical = canonicalPathname(url.pathname);
	if (canonical === null) return undefined;

	url.pathname = canonical;

	return new Response(null, {
		status: PERMANENT_REDIRECT,
		headers: {
			// Same origin as the request, so a staging or workers.dev host keeps
			// redirecting within itself instead of jumping to production.
			Location: url.toString(),
			"Cache-Control": CACHE_CONTROL,
		},
	});
}
