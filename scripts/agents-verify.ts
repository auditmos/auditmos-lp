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
	beaconProbeTargets,
	formatBeaconReport,
	HTML_ACCEPT_HEADER,
	verifyBeacons,
} from "./analytics-verify-lib";
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

// The sitemap drives both live checks below, so a new page joins them with
// nothing to remember. Fetched once: two probes of the same document would only
// invite the two check lists to disagree about what the site contains.
const sitemapResponse = await fetch(new URL("/sitemap.xml", target));
const sitemapXml = sitemapResponse.ok ? await sitemapResponse.text() : undefined;

// Canonical redirects, checked against the wire because they cannot be checked
// anywhere else: the failure lives in Cloudflare's asset router deciding whether
// the Worker is reached at all, which no build artifact describes. See #38.
const redirectFailures = await verifyCanonicalRedirects(target, sitemapXml);

process.stdout.write("\nCanonical URLs\n\n");
process.stdout.write(redirectFailures.report);

// Analytics, same reasoning one layer further out: the beacon is injected by the
// edge after the Worker returns, so it appears in no build artifact and cannot be
// asserted anywhere but against a deployed host. See #39.
const beaconFailures = await verifyAnalyticsBeacon(target, sitemapXml);

process.stdout.write("\nWeb Analytics\n\n");
process.stdout.write(beaconFailures.report);

if (!result.ok || redirectFailures.failed || beaconFailures.failed) {
	console.error(
		"\nA check the site implements has stopped passing. Deploy propagation can\n" +
			"take a couple of minutes — re-run before treating it as a real regression.",
	);
	process.exit(1);
}

async function verifyCanonicalRedirects(
	origin: string,
	sitemapXml: string | undefined,
): Promise<{
	report: string;
	failed: boolean;
}> {
	if (sitemapXml === undefined) {
		return {
			report: "  MISSING    sitemap.xml did not load; redirects unverified\n",
			failed: true,
		};
	}

	// Rebased onto `origin`: staging's sitemap advertises production URLs, so
	// only the paths are taken from it. Otherwise verifying staging would probe
	// production and report the result as staging's.
	const targets = trailingSlashProbeTargets(sitemapXml, origin);
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

async function verifyAnalyticsBeacon(
	origin: string,
	sitemapXml: string | undefined,
): Promise<{
	report: string;
	failed: boolean;
}> {
	if (sitemapXml === undefined) {
		return {
			report: "  MISSING    sitemap.xml did not load; analytics unverified\n",
			failed: true,
		};
	}

	const probes = await Promise.all(
		beaconProbeTargets(sitemapXml, origin).map(async (url) => {
			// The Accept header is the whole check. Without it Cloudflare skips
			// injection and every page looks beacon-free, which is precisely the
			// false negative that let #39 sit unnoticed.
			const response = await fetch(url, { headers: { Accept: HTML_ACCEPT_HEADER } });

			return { url, html: await response.text() };
		}),
	);

	const failures = verifyBeacons(probes);

	return {
		report: formatBeaconReport(failures, probes.length),
		failed: failures.length > 0 || probes.length === 0,
	};
}
