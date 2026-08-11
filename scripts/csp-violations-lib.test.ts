import {
	type CspViolation,
	formatSummary,
	splitJsonRecords,
	violationsIn,
} from "./csp-violations-lib";

function violation(overrides: Partial<CspViolation> = {}): CspViolation {
	return {
		blockedUri: "https://cdn.example/a.js",
		documentUri: "https://auditmos.com/contact",
		effectiveDirective: "script-src-elem",
		violatedDirective: "script-src-elem",
		...overrides,
	};
}

/** A real `wrangler tail --format json` record, trimmed to the fields read. */
const violationRecord = JSON.stringify({
	outcome: "ok",
	scriptName: "auditmos-lp-production",
	logs: [
		{
			message: [
				"csp_violation",
				{
					blockedUri: "https://cdn.example/a.js",
					documentUri: "https://auditmos.com/contact",
					effectiveDirective: "script-src-elem",
					violatedDirective: "script-src-elem",
				},
			],
			level: "warn",
			timestamp: 1786459551078,
		},
	],
	event: { request: { url: "https://auditmos.com/api/csp-report", method: "POST" } },
});

describe("violationsIn", () => {
	it("reads the violation out of a tail record", () => {
		expect(violationsIn(violationRecord)).toEqual([
			{
				blockedUri: "https://cdn.example/a.js",
				documentUri: "https://auditmos.com/contact",
				effectiveDirective: "script-src-elem",
				violatedDirective: "script-src-elem",
			},
		]);
	});
});

describe("splitJsonRecords", () => {
	it("splits the pretty-printed objects wrangler emits, holding back a partial one", () => {
		// `--format json` pretty-prints each event across many lines rather than
		// emitting newline-delimited JSON, so reading the stream a line at a time
		// yields fragments that never parse.
		const buffer = '{\n    "a": 1\n}\n{\n    "b": 2\n}\n{\n    "c":';

		expect(splitJsonRecords(buffer)).toEqual({
			records: ['{\n    "a": 1\n}', '{\n    "b": 2\n}'],
			rest: '{\n    "c":',
		});
	});

	it("does not end a record on an unbalanced brace inside a string", () => {
		// `blockedUri` is copied out of the report body and `user-agent` comes from
		// the caller, so a lone brace in either is reachable by anyone who wants
		// the watch desynced for the rest of the week. A *balanced* pair — the
		// `cf-visitor: "{\"scheme\":\"https\"}"` header on every real record —
		// would not discriminate here: depth counting lands correctly either way.
		const record = JSON.stringify({ blockedUri: "https://x.example/a}b" });

		expect(splitJsonRecords(record)).toEqual({ records: [record], rest: "" });
	});

	it("yields nothing from the banner wrangler prints before the stream", () => {
		// A week-long watch must not be ended by a line that is not a record.
		const banner = "Successfully created tail, expires at 2026-08-11T20:02:04Z\n";

		expect(splitJsonRecords(banner)).toEqual({ records: [], rest: "" });
		expect(violationsIn(banner)).toEqual([]);
	});
});

describe("formatSummary", () => {
	it("groups by directive and blocked URI, worst offender first", () => {
		const summary = formatSummary([
			violation({ blockedUri: "data:", effectiveDirective: "img-src" }),
			violation(),
			violation(),
		]);

		expect(summary).toContain("3 violations");
		expect(summary).toContain("2 × script-src-elem");
		expect(summary).toContain("1 × img-src");
		// Ordering is the point: the first line is what you act on.
		expect(summary.indexOf("script-src-elem")).toBeLessThan(summary.indexOf("img-src"));
	});

	it("names the pages a violation fired on, since that is where the fix goes", () => {
		const summary = formatSummary([violation({ documentUri: "https://auditmos.com/work" })]);

		expect(summary).toContain("https://auditmos.com/work");
	});

	it("says plainly when nothing arrived", () => {
		// Read by someone deciding whether it is safe to enforce, so "nothing seen"
		// has to be unmistakable rather than an empty stretch of terminal.
		expect(formatSummary([])).toContain("No violations");
	});
});
