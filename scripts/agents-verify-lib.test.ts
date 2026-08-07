import {
	formatVerifyReport,
	isApex,
	REQUIRED_CHECKS,
	type RequiredCheck,
	type ScanReport,
	verifyScan,
} from "./agents-verify-lib";

const required = [
	{ id: "discoverability.sitemap", backedBy: "src/pages/sitemap.xml.ts" },
	{ id: "discoverability.dnsAid", backedBy: "DNS records", apexOnly: true },
] as const satisfies readonly RequiredCheck[];

function report(checks: Record<string, Record<string, { status: string; message?: string }>>) {
	return { checks } satisfies ScanReport;
}

const allPassing = report({
	discoverability: { sitemap: { status: "pass" }, dnsAid: { status: "pass" } },
});

describe("verifyScan", () => {
	it("passes when every required check passes", () => {
		const result = verifyScan(allPassing, { apex: true, required });

		expect(result.ok).toBe(true);
		expect(result.regressions).toEqual([]);
		expect(result.passing).toBe(2);
	});

	it("reports a required check that stopped passing, with what backs it", () => {
		const result = verifyScan(
			report({
				discoverability: {
					sitemap: { status: "fail", message: "sitemap.xml not found" },
					dnsAid: { status: "pass" },
				},
			}),
			{ apex: true, required },
		);

		expect(result.ok).toBe(false);
		expect(result.regressions).toEqual([
			{
				id: "discoverability.sitemap",
				status: "fail",
				message: "sitemap.xml not found",
				backedBy: "src/pages/sitemap.xml.ts",
			},
		]);
	});

	it.each(["fail", "neutral", "warn"])("treats %j as not passing", (status) => {
		const result = verifyScan(report({ discoverability: { sitemap: { status } } }), {
			apex: false,
			required,
		});

		expect(result.regressions.map((check) => check.id)).toEqual(["discoverability.sitemap"]);
	});

	it("skips apex-only checks off the apex instead of failing them", () => {
		const result = verifyScan(report({ discoverability: { sitemap: { status: "pass" } } }), {
			apex: false,
			required,
		});

		expect(result.ok).toBe(true);
		expect(result.skipped).toEqual(["discoverability.dnsAid"]);
		expect(result.regressions).toEqual([]);
	});

	it("still enforces apex-only checks on the apex", () => {
		const result = verifyScan(report({ discoverability: { sitemap: { status: "pass" } } }), {
			apex: true,
			required,
		});

		// Absent, not failing — the guard has to notice either way.
		expect(result.ok).toBe(false);
		expect(result.missing).toEqual(["discoverability.dnsAid"]);
	});

	it("fails when a required check vanishes from the report", () => {
		// A renamed or dropped scanner check would otherwise read as success:
		// nothing failed because nothing was looked at.
		const result = verifyScan(report({ discoverability: { dnsAid: { status: "pass" } } }), {
			apex: true,
			required,
		});

		expect(result.ok).toBe(false);
		expect(result.missing).toEqual(["discoverability.sitemap"]);
	});

	it("surfaces checks that pass without being declared, so the list can be widened", () => {
		const result = verifyScan(
			report({
				discoverability: { sitemap: { status: "pass" }, dnsAid: { status: "pass" } },
				discovery: { mcpServerCard: { status: "pass" }, a2aAgentCard: { status: "fail" } },
			}),
			{ apex: true, required },
		);

		expect(result.ok).toBe(true);
		expect(result.undeclared.map((check) => check.id)).toEqual(["discovery.mcpServerCard"]);
	});

	it("ignores failing checks for protocols the site does not implement", () => {
		// Eight of these fail on every scan by design; they must not fail the run.
		const result = verifyScan(
			report({
				discoverability: { sitemap: { status: "pass" }, dnsAid: { status: "pass" } },
				discovery: { oauthDiscovery: { status: "fail" }, webMcp: { status: "fail" } },
				commerce: { x402: { status: "neutral" } },
			}),
			{ apex: true, required },
		);

		expect(result.ok).toBe(true);
		expect(result.regressions).toEqual([]);
	});

	it("treats an empty report as a total regression rather than a pass", () => {
		const result = verifyScan({}, { apex: true, required });

		expect(result.ok).toBe(false);
		expect(result.missing).toEqual(required.map((check) => check.id));
	});
});

describe("REQUIRED_CHECKS", () => {
	it("declares every id as <group>.<name> so it can be matched in the report", () => {
		for (const check of REQUIRED_CHECKS) {
			expect({ id: check.id, shape: /^[a-zA-Z]+\.[a-zA-Z]+$/.test(check.id) }).toEqual({
				id: check.id,
				shape: true,
			});
		}
	});

	it("says what backs each check, so a regression names the thing that broke", () => {
		for (const check of REQUIRED_CHECKS) {
			expect({ id: check.id, backed: check.backedBy.length > 0 }).toEqual({
				id: check.id,
				backed: true,
			});
		}
	});

	it("declares no duplicate ids", () => {
		const ids = REQUIRED_CHECKS.map((check) => check.id);

		expect(ids).toEqual([...new Set(ids)]);
	});
});

describe("isApex", () => {
	it.each([
		["https://auditmos.com", true],
		["https://auditmos.com/", true],
		["https://staging.auditmos.com", false],
		["http://localhost:4321", false],
		["not a url", false],
	])("%j → %s", (target, expected) => {
		expect(isApex(target, "https://auditmos.com")).toBe(expected);
	});
});

describe("formatVerifyReport", () => {
	it("names the regressed check, its message, and what should have made it pass", () => {
		const output = formatVerifyReport(
			verifyScan(
				report({
					discoverability: {
						sitemap: { status: "fail", message: "sitemap.xml not found" },
						dnsAid: { status: "pass" },
					},
				}),
				{ apex: true, required },
			),
			"https://auditmos.com",
		);

		expect(output).toContain("REGRESSED");
		expect(output).toContain("discoverability.sitemap");
		expect(output).toContain("sitemap.xml not found");
		expect(output).toContain("src/pages/sitemap.xml.ts");
	});

	it("confirms the target and the pass count when nothing regressed", () => {
		const output = formatVerifyReport(
			verifyScan(allPassing, { apex: true, required }),
			"https://auditmos.com",
		);

		expect(output).toContain("https://auditmos.com");
		expect(output).toContain("every required check passes");
		expect(output).not.toContain("REGRESSED");
	});
});
