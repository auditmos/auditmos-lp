/**
 * What an `assets.run_worker_first` pattern does and does not claim.
 *
 * The list in wrangler.jsonc decides which requests reach the Worker before the
 * asset server answers them. Its patterns match the request path **literally**,
 * which is the part that reads wrong: `/about` looks like it covers the About
 * page, and it does not cover `/about/`. That gap left every static page's
 * trailing-slash URL to the asset server's `html_handling`, which answers with
 * a 307 — so `canonicalRedirect()`, and the 301 the site depends on for
 * canonicalisation, never ran for them (issue #38). `/work/*` behaved correctly
 * only because a wildcard is the one pattern shape that spans both forms.
 *
 * This models the subset the site uses: literal paths and `*` wildcards. The
 * `!` negation prefix Cloudflare also accepts is not used here and is not
 * interpreted — a pattern starting with `!` is treated as the literal path it
 * spells, so introducing one would fail this matcher loudly rather than
 * silently claiming the wrong thing.
 */

/** `*` spans any run of characters, including `/`; everything else is literal. */
function patternToRegExp(pattern: string): RegExp {
	const source = pattern
		.split("*")
		.map((literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join(".*");

	return new RegExp(`^${source}$`);
}

/** True when at least one pattern routes `pathname` to the Worker first. */
export function claimsPath(patterns: readonly string[], pathname: string): boolean {
	return patterns.some((pattern) => patternToRegExp(pattern).test(pathname));
}
