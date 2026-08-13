/**
 * TDD assumptions for the deferred-security gates:
 * - Every decision is a pure function of observations plus a clock, so the
 *   tests supply both and never touch DNS or TLS.
 * - `blocked` must outrank `due` everywhere: acting on a gate whose
 *   precondition broke is worse than acting late.
 */

import {
	CAA_PUBLISHED_AT,
	evaluateGates,
	formatGateReport,
	type GateObservations,
	gatesNeedingAttention,
} from "./security-gates-lib";

const healthy: GateObservations = {
	now: new Date("2026-08-14T00:00:00Z"),
	mtaSts: { servedMode: "testing", txtId: "20260813095531", mxMatches: true },
	dmarc: { policy: "none" },
	caa: {
		records: ['0 issue "pki.goog"'],
		leafNotBefore: new Date("2026-06-21T00:00:00Z"),
		leafNotAfter: new Date("2026-11-08T00:00:00Z"),
	},
};

const gate = (id: string, overrides: Partial<GateObservations> = {}) => {
	const report = evaluateGates({ ...healthy, ...overrides }).find((r) => r.id === id);
	if (!report) throw new Error(`no gate ${id}`);
	return report;
};

describe("mta-sts-enforce", () => {
	it("waits while the policy is still soaking", () => {
		expect(gate("mta-sts-enforce")).toMatchObject({ status: "waiting" });
	});

	it("counts down in days rather than announcing a date", () => {
		expect(gate("mta-sts-enforce").detail).toContain("6 days");
	});

	it("comes due once the soak window has passed", () => {
		expect(gate("mta-sts-enforce", { now: new Date("2026-08-21T00:00:00Z") })).toMatchObject({
			status: "due",
		});
	});

	it("blocks on an MX mismatch even after the gate opens", () => {
		// The dangerous case: enforce with a wrong mx list refuses inbound mail.
		const report = gate("mta-sts-enforce", {
			now: new Date("2026-09-01T00:00:00Z"),
			mtaSts: { servedMode: "testing", txtId: "1", mxMatches: false },
		});

		expect(report.status).toBe("blocked");
		expect(report.nextStep).toContain("Do **not** flip");
	});

	it("blocks when the policy does not load at all", () => {
		expect(gate("mta-sts-enforce", { mtaSts: {} })).toMatchObject({ status: "blocked" });
	});

	it("blocks when the TXT record carries no id to re-fetch on", () => {
		expect(
			gate("mta-sts-enforce", { mtaSts: { servedMode: "testing", mxMatches: true } }),
		).toMatchObject({ status: "blocked" });
	});

	it("is satisfied once enforce is actually being served", () => {
		const report = gate("mta-sts-enforce", {
			now: new Date("2026-09-01T00:00:00Z"),
			mtaSts: { servedMode: "enforce", txtId: "2", mxMatches: true },
		});

		expect(report).toMatchObject({ status: "satisfied" });
		expect(report.nextStep).toBeUndefined();
	});
});

describe("dmarc-quarantine", () => {
	it("waits while reports accumulate", () => {
		expect(gate("dmarc-quarantine")).toMatchObject({ status: "waiting" });
	});

	it("comes due after the two-week window", () => {
		expect(gate("dmarc-quarantine", { now: new Date("2026-08-27T00:00:00Z") })).toMatchObject({
			status: "due",
		});
	});

	it("still points at the reports rather than just the flip", () => {
		const report = gate("dmarc-quarantine", { now: new Date("2026-08-27T00:00:00Z") });

		expect(report.nextStep).toContain("aggregate reports");
	});

	it.each(["quarantine", "reject"])("is satisfied at p=%s", (policy) => {
		expect(gate("dmarc-quarantine", { dmarc: { policy } })).toMatchObject({ status: "satisfied" });
	});

	it("blocks when the policy has disappeared entirely", () => {
		expect(gate("dmarc-quarantine", { dmarc: {} })).toMatchObject({ status: "blocked" });
	});
});

describe("caa-renewal", () => {
	it("waits while the leaf still predates the policy and expiry is far off", () => {
		expect(gate("caa-renewal")).toMatchObject({ status: "waiting" });
	});

	it("is satisfied by a leaf issued after the policy — the only real proof", () => {
		const report = gate("caa-renewal", {
			caa: {
				...healthy.caa,
				leafNotBefore: new Date(CAA_PUBLISHED_AT.getTime() + 86_400_000),
				leafNotAfter: new Date("2027-01-01T00:00:00Z"),
			},
		});

		expect(report.status).toBe("satisfied");
		expect(report.detail).toContain("renewal has completed");
	});

	it("does not accept a leaf issued earlier the same day as proof", () => {
		// Regression: with a date-only CAA_PUBLISHED_AT this passed. The real leaf
		// was reissued at 08:58 UTC on publication day — when mta-sts.auditmos.com
		// joined the certificate — and the records only existed from 10:43.
		const report = gate("caa-renewal", {
			caa: {
				...healthy.caa,
				leafNotBefore: new Date("2026-08-13T08:58:05Z"),
				leafNotAfter: new Date("2026-11-11T09:57:48Z"),
			},
		});

		expect(report.status).toBe("waiting");
	});

	it("blocks when expiry closes in with no renewal — CAA may be refusing issuance", () => {
		const report = gate("caa-renewal", { now: new Date("2026-10-25T00:00:00Z") });

		expect(report.status).toBe("blocked");
		expect(report.nextStep).toContain("issuing CA");
	});

	it("blocks when the CAA records have vanished", () => {
		expect(gate("caa-renewal", { caa: { ...healthy.caa, records: [] } })).toMatchObject({
			status: "blocked",
		});
	});

	it("blocks when the certificate cannot be read at all", () => {
		expect(gate("caa-renewal", { caa: { records: ['0 issue "pki.goog"'] } })).toMatchObject({
			status: "blocked",
		});
	});
});

describe("gatesNeedingAttention", () => {
	it("is empty when everything is waiting or satisfied", () => {
		expect(gatesNeedingAttention(evaluateGates(healthy))).toEqual([]);
	});

	it("collects both due and blocked gates", () => {
		const reports = evaluateGates({
			...healthy,
			now: new Date("2026-09-01T00:00:00Z"),
			mtaSts: { servedMode: "testing", txtId: "1", mxMatches: false },
		});

		expect(
			gatesNeedingAttention(reports)
				.map((r) => r.status)
				.sort(),
		).toEqual(["blocked", "due"]);
	});
});

describe("formatGateReport", () => {
	it("renders a table with every gate", () => {
		const table = formatGateReport(evaluateGates(healthy));

		expect(table).toContain("| Gate | Status | Observed |");
		expect(table).toContain("MTA-STS");
		expect(table).toContain("DMARC");
		expect(table).toContain("CAA");
	});

	it("omits the next-steps section when nothing needs doing", () => {
		expect(formatGateReport(evaluateGates(healthy))).not.toContain("Next steps");
	});

	it("lists next steps when a gate is due", () => {
		const table = formatGateReport(evaluateGates({ ...healthy, now: new Date("2026-09-01") }));

		expect(table).toContain("### Next steps");
	});
});
