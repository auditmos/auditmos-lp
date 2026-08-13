/**
 * TDD assumptions for issue #39:
 * - The beacon is injected at Cloudflare's edge, so it can only be checked
 *   against a deployed host; these helpers stay pure and the fetch lives in
 *   `agents-verify.ts`.
 * - Both a missing beacon and a duplicated one are regressions, in opposite
 *   directions.
 */

import {
	beaconProbeTargets,
	countBeacons,
	formatBeaconReport,
	HTML_ACCEPT_HEADER,
	verifyBeacons,
} from "./analytics-verify-lib";

const beaconTag =
	'<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v4513226" ' +
	'integrity="sha512-abc" data-cf-beacon=\'{"version":"2024.11.0","token":"t","r":1}\' ' +
	'crossorigin="anonymous"></script>';

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
	<url><loc>https://auditmos.com/</loc></url>
	<url><loc>https://auditmos.com/work</loc></url>
	<url><loc>https://auditmos.com/about</loc></url>
</urlset>`;

describe("HTML_ACCEPT_HEADER", () => {
	it("asks for HTML, which is what makes the edge inject at all", () => {
		// A wildcard Accept returns a beacon-free page even when analytics works,
		// which is how #39 was misdiagnosed as "analytics is dead".
		expect(HTML_ACCEPT_HEADER.startsWith("text/html")).toBe(true);
	});
});

describe("beaconProbeTargets", () => {
	it("probes the homepage plus one deeper page, rebased onto the host", () => {
		expect(beaconProbeTargets(sitemap, "https://staging.auditmos.com")).toEqual([
			"https://staging.auditmos.com/",
			"https://staging.auditmos.com/work",
		]);
	});

	it("still probes the homepage when the sitemap is empty", () => {
		expect(beaconProbeTargets("<urlset></urlset>", "https://auditmos.com")).toEqual([
			"https://auditmos.com/",
		]);
	});

	it("does not probe the same page twice when the sitemap lists it with a slash", () => {
		const targets = beaconProbeTargets(
			"<urlset><url><loc>https://auditmos.com/</loc></url></urlset>",
			"https://auditmos.com",
		);

		expect(targets).toEqual(["https://auditmos.com/"]);
	});
});

describe("countBeacons", () => {
	it.each([
		["no beacon", "<html><head></head></html>", 0],
		["one beacon", `<html><head>${beaconTag}</head></html>`, 1],
		["two beacons", `<html><head>${beaconTag}${beaconTag}</head></html>`, 2],
	])("counts %s", (_label, html, expected) => {
		expect(countBeacons(html)).toBe(expected);
	});
});

describe("verifyBeacons", () => {
	it("passes a page carrying exactly one beacon", () => {
		expect(verifyBeacons([{ url: "https://auditmos.com/", html: beaconTag }])).toEqual([]);
	});

	it("fails a page with no beacon, naming the privacy-notice consequence", () => {
		const failures = verifyBeacons([{ url: "https://auditmos.com/", html: "<html></html>" }]);

		expect(failures).toHaveLength(1);
		expect(failures[0]?.reason).toContain("/privacy");
	});

	it("fails a page with a duplicated beacon, which double-counts silently", () => {
		const failures = verifyBeacons([
			{ url: "https://auditmos.com/", html: `${beaconTag}${beaconTag}` },
		]);

		expect(failures).toHaveLength(1);
		expect(failures[0]?.reason).toContain("counted 2 times");
	});
});

describe("formatBeaconReport", () => {
	it("reports the probed count on success", () => {
		expect(formatBeaconReport([], 2)).toContain("all 2 pages");
	});

	it("reports that nothing was probed rather than claiming a pass", () => {
		expect(formatBeaconReport([], 0)).toContain("MISSING");
	});

	it("prints each failing URL with its reason", () => {
		const report = formatBeaconReport([{ url: "https://auditmos.com/", reason: "no beacon" }], 1);

		expect(report).toContain("REGRESSED");
		expect(report).toContain("https://auditmos.com/");
		expect(report).toContain("no beacon");
	});
});
