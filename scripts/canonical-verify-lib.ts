/**
 * Pure helpers for the live canonical-redirect check in `pnpm agents:verify`.
 *
 * Issue #38 could not be caught from the build output, and that is the reason
 * this exists rather than another assertion in `build-output.test.ts`. Every
 * build-level fact was *true* while the site was serving the wrong status:
 * `html_handling` was configured, and `canonicalRedirect()` was compiled into
 * the Worker entry. What was false — that the Worker is reached at all for
 * `/about/` — is a property of Cloudflare's asset router sitting in front of
 * the Worker, which no build artifact describes and `pnpm dev` never runs.
 *
 * So the check has to be made against a deployed host, from outside. The fetch
 * lives in `agents-verify.ts`; everything here is testable without it.
 */

/** A trailing-slash URL and what the deployed host answered for it. */
export interface RedirectProbe {
	url: string;
	status: number;
	/** The `Location` header, absolute or relative, or null when absent. */
	location: string | null;
}

export interface RedirectFailure {
	url: string;
	status: number;
	location: string | null;
	reason: string;
}

/**
 * 301, not 302/307: the slash-free URL is canonical permanently, and only a
 * permanent redirect consolidates ranking signals onto it. This mirrors
 * `PERMANENT_REDIRECT` in `src/site/canonical-url.ts` — the value is asserted
 * here against the wire rather than imported, so the two agreeing means the
 * deployed site agrees, not that one constant equals itself.
 */
const REQUIRED_STATUS = 301;

/**
 * Every URL in a sitemap, in its non-canonical trailing-slash form.
 *
 * Sitemap-driven so the probe list cannot drift behind the site: a new page or
 * project is covered the moment it is published, with nothing to remember. The
 * root is excluded — it is canonical *with* its slash and has no second form.
 */
export function trailingSlashProbeTargets(sitemapXml: string): string[] {
	const locations = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
		match[1].trim(),
	);

	return [
		...new Set(
			locations.filter((location) => !location.endsWith("/")).map((location) => `${location}/`),
		),
	].sort();
}

/**
 * The probes that did not answer with a permanent redirect to the canonical URL.
 *
 * A 307 here is the exact failure in #38: the asset server answered under
 * `html_handling` because `run_worker_first` did not claim the slash form.
 */
export function verifyTrailingSlashRedirects(probes: readonly RedirectProbe[]): RedirectFailure[] {
	const failures: RedirectFailure[] = [];

	for (const probe of probes) {
		const reason = describeFailure(probe);
		if (reason) failures.push({ ...probe, reason });
	}

	return failures;
}

function describeFailure(probe: RedirectProbe): string | undefined {
	if (probe.status !== REQUIRED_STATUS) {
		return probe.status === 307 || probe.status === 302
			? `answered ${probe.status} (temporary) — the asset server, not the Worker; ` +
					"add this path's trailing-slash form to run_worker_first"
			: `answered ${probe.status}, expected ${REQUIRED_STATUS}`;
	}

	if (!probe.location) return "redirected without a Location header";

	const expected = new URL(probe.url).pathname.replace(/\/+$/, "");
	const actual = new URL(probe.location, probe.url).pathname;

	return actual === expected
		? undefined
		: `redirected to ${actual}, expected the slash-free ${expected}`;
}

export function formatRedirectReport(failures: readonly RedirectFailure[], probed: number): string {
	if (probed === 0) {
		return "  MISSING    no sitemap URLs to probe — canonical redirects unverified\n";
	}

	if (failures.length === 0) {
		return `  OK         all ${probed} trailing-slash URLs 301 to their canonical form\n`;
	}

	return failures
		.map((failure) => `  REGRESSED  ${failure.url}\n             ${failure.reason}\n`)
		.join("");
}
