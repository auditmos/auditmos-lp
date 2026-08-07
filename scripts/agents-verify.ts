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

if (!result.ok) {
	console.error(
		"\nA check the site implements has stopped passing. Deploy propagation can\n" +
			"take a couple of minutes — re-run before treating it as a real regression.",
	);
	process.exit(1);
}
