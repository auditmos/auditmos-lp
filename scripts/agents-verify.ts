/**
 * Verify a deployed environment still passes every agent-readiness check the
 * site actually implements.
 *
 *   pnpm agents:verify                                  # production
 *   pnpm agents:verify https://staging.auditmos.com     # any other host
 *
 * Exits non-zero on a regression, so it can gate a deploy or run in CI.
 * The required set and the diff logic live in `agents-verify-lib.ts`.
 */

import { site } from "../src/brand/site";
import { formatVerifyReport, isApex, type ScanReport, verifyScan } from "./agents-verify-lib";
import {
	formatRedirectReport,
	trailingSlashProbeTargets,
	verifyTrailingSlashRedirects,
} from "./canonical-verify-lib";

const scannerUrl = "https://isitagentready.com/api/scan";
const target = process.argv[2] ?? site.url;

try {
	new URL(target);
} catch {
	console.error(`Not a URL: ${target}`);
	console.error(`Usage: pnpm agents:verify [url]   (default ${site.url})`);
	process.exit(1);
}

const response = await fetch(scannerUrl, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({ url: target }),
});

if (!response.ok) {
	console.error(`Scanner returned ${response.status} ${response.statusText}.`);
	process.exit(1);
}

const result = verifyScan((await response.json()) as ScanReport, {
	apex: isApex(target, site.url),
});

process.stdout.write(formatVerifyReport(result, target));

// Canonical redirects, checked against the wire because they cannot be checked
// anywhere else: the failure lives in Cloudflare's asset router deciding whether
// the Worker is reached at all, which no build artifact describes. See #38.
const redirectFailures = await verifyCanonicalRedirects(target);

process.stdout.write("\nCanonical URLs\n\n");
process.stdout.write(redirectFailures.report);

if (!result.ok || redirectFailures.failed) {
	console.error(
		"\nA check the site implements has stopped passing. Deploy propagation can\n" +
			"take a couple of minutes — re-run before treating it as a real regression.",
	);
	process.exit(1);
}

async function verifyCanonicalRedirects(origin: string): Promise<{
	report: string;
	failed: boolean;
}> {
	const sitemapResponse = await fetch(new URL("/sitemap.xml", origin));

	if (!sitemapResponse.ok) {
		return {
			report: `  MISSING    sitemap.xml returned ${sitemapResponse.status}; redirects unverified\n`,
			failed: true,
		};
	}

	const targets = trailingSlashProbeTargets(await sitemapResponse.text());
	const probes = await Promise.all(
		targets.map(async (url) => {
			// `manual` so the status is the site's own answer rather than whatever
			// the end of the redirect chain returns — the status *is* the assertion.
			const response = await fetch(url, { redirect: "manual" });

			return { url, status: response.status, location: response.headers.get("location") };
		}),
	);

	const failures = verifyTrailingSlashRedirects(probes);

	return {
		report: formatRedirectReport(failures, probes.length),
		failed: failures.length > 0 || probes.length === 0,
	};
}
