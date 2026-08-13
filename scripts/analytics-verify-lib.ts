/**
 * Pure helpers for the live Web Analytics beacon check in `pnpm agents:verify`.
 *
 * This exists for the same reason as `canonical-verify-lib.ts`: the fact being
 * checked is not in the build output. Cloudflare injects the beacon "as the HTML
 * response passes through Cloudflare's edge network to the browser" — that is,
 * *after* the Worker has returned. Nothing in `dist/` mentions it, `pnpm dev`
 * never shows it, and the Worker cannot see or alter it.
 *
 * Two opposite regressions are worth catching, which is why this counts tags
 * rather than merely asserting presence:
 *
 * - **Zero** beacons — the #39 state, where `/privacy` claimed analytics that
 *   was not running. Silent by construction: nothing errors when a page simply
 *   has one fewer script tag.
 * - **Two or more** — what happens if the removed build-time injection path is
 *   ever restored while edge injection stays on. Every pageview is counted
 *   twice, and the numbers stay plausible while being wrong, which is worse
 *   than an obvious zero.
 *
 * The `Accept` header is the load-bearing detail. Cloudflare injects only for
 * requests that ask for HTML; a plain `curl` sends a wildcard `Accept` and gets
 * a beacon-free page whether or not analytics works. That false negative is
 * exactly how #39 was diagnosed, so the header is a constant here rather than a
 * caller's choice.
 */

/** What a browser sends. Anything less and the edge does not inject (#39). */
export const HTML_ACCEPT_HEADER = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

/** The injected tag's origin — also what `script-src` must allow. */
const BEACON_ORIGIN = "https://static.cloudflareinsights.com";

/** Matches each injected beacon tag; global so occurrences can be counted. */
const BEACON_PATTERN = /https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/g;

/** A page fetched with a browser `Accept`, and the HTML it answered with. */
export interface BeaconProbe {
	url: string;
	html: string;
}

export interface BeaconFailure {
	url: string;
	reason: string;
}

/**
 * The pages to probe, taken from the sitemap so the list cannot drift behind the
 * site, and rebased onto the host under test for the reason spelled out in
 * `trailingSlashProbeTargets` — every environment's sitemap advertises
 * production URLs.
 *
 * Two pages, not all of them: injection is a zone-wide edge behaviour, so a
 * third page tells you nothing a second one did not. The second exists only to
 * catch "the homepage is special" — it is served from a different prerendered
 * asset, and a rule scoped to `/` would otherwise look like full coverage.
 */
export function beaconProbeTargets(sitemapXml: string, origin: string, limit = 2): string[] {
	const paths = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
		new URL(match[1].trim()).pathname.replace(/\/+$/, ""),
	);
	const unique = [...new Set(["", ...paths])];

	return unique.slice(0, limit).map((pathname) => new URL(pathname || "/", origin).toString());
}

/** How many beacon tags a page carries. Exported for the report line. */
export function countBeacons(html: string): number {
	return html.match(BEACON_PATTERN)?.length ?? 0;
}

export function verifyBeacons(probes: readonly BeaconProbe[]): BeaconFailure[] {
	const failures: BeaconFailure[] = [];

	for (const probe of probes) {
		const count = countBeacons(probe.html);

		if (count === 0) {
			failures.push({
				url: probe.url,
				reason:
					"no Web Analytics beacon — /privacy claims analytics that is not running; " +
					"check RUM automatic injection is still enabled for the zone",
			});
			continue;
		}

		if (count > 1) {
			failures.push({
				url: probe.url,
				reason:
					`${count} beacons — every pageview is counted ${count} times; ` +
					"the edge injects one, so the page must not emit its own",
			});
		}
	}

	return failures;
}

export function formatBeaconReport(failures: readonly BeaconFailure[], probed: number): string {
	if (probed === 0) {
		return "  MISSING    no sitemap URLs to probe — analytics unverified\n";
	}

	if (failures.length === 0) {
		return `  OK         exactly one ${BEACON_ORIGIN} beacon on all ${probed} pages\n`;
	}

	return failures
		.map((failure) => `  REGRESSED  ${failure.url}\n             ${failure.reason}\n`)
		.join("");
}
