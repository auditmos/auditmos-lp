/**
 * The three security changes this repo deliberately deferred, and how to tell
 * when each is ready — or has quietly gone wrong.
 *
 * Every one of them is a *timed* commitment rather than a task: MTA-STS ships
 * in `testing` for a week before `enforce` (#34), DMARC sits at `p=none` for
 * two weeks before `quarantine` (#32), and a CAA policy is only proven by a
 * certificate renewal months later (#31). Nothing fails if they are forgotten,
 * which is exactly why they get forgotten — the site keeps working, slightly
 * less protected than intended, indefinitely.
 *
 * So the checks live here rather than in anyone's calendar, and they are
 * two-sided: a gate can be `due` (do the thing) or `blocked` (a precondition
 * broke, do *not* do the thing), and the blocked half is the more valuable one.
 * Flipping MTA-STS to `enforce` while the policy's MX list disagrees with DNS
 * refuses inbound mail.
 *
 * Pure by design — every observation is passed in, so the decisions are
 * testable without DNS, TLS or a clock. `security-gates.ts` does the I/O.
 */

/** When each gate opens, and the fact each one is measured against. */
export const MTA_STS_ENFORCE_FROM = new Date("2026-08-20T00:00:00Z");
export const DMARC_QUARANTINE_FROM = new Date("2026-08-26T00:00:00Z");
/**
 * When the CAA policy became complete, to the second — not the date.
 *
 * Taken from `created_on` of the last record Cloudflare accepted. A date-only
 * value here is a false-positive generator: the production leaf was reissued at
 * 08:58 UTC that morning, when `mta-sts.auditmos.com` was added to it, nearly
 * two hours *before* these records existed. Rounded to midnight, that leaf
 * "proved" a policy it predates, which is the one thing this gate exists to
 * establish.
 */
export const CAA_PUBLISHED_AT = new Date("2026-08-13T10:43:51.680Z");

/**
 * How close to expiry a certificate may get before a *missing* renewal stops
 * being "not yet" and starts being "the CAA policy is refusing issuance".
 * Cloudflare renews Universal certificates well inside this window.
 */
export const CAA_RENEWAL_ALARM_DAYS = 21;

export type GateStatus = "waiting" | "due" | "satisfied" | "blocked";

export interface GateReport {
	id: string;
	title: string;
	status: GateStatus;
	/** What was observed, in one line. */
	detail: string;
	/** What a human should do about it. Absent when there is nothing to do. */
	nextStep?: string;
}

export interface GateObservations {
	now: Date;
	mtaSts: {
		/** The `mode:` of the policy actually being served, if it loaded. */
		servedMode?: string;
		/** The `id=` in the `_mta-sts` TXT record. */
		txtId?: string;
		/** Whether the served policy's `mx:` list matches live MX records. */
		mxMatches?: boolean;
	};
	dmarc: {
		/** The `p=` value of the published policy, if there is one. */
		policy?: string;
	};
	caa: {
		/** Every CAA record string on the zone. Empty means no policy. */
		records: readonly string[];
		/** The production leaf's validity window, if the handshake succeeded. */
		leafNotBefore?: Date;
		leafNotAfter?: Date;
	};
}

const daysBetween = (from: Date, to: Date): number =>
	Math.round((to.getTime() - from.getTime()) / 86_400_000);

/**
 * MTA-STS: ready to leave `testing`?
 *
 * `blocked` outranks `due` on purpose. An MX mismatch under `enforce` is the
 * one failure in this file that stops mail rather than merely weakening it.
 */
function mtaStsGate({ now, mtaSts }: GateObservations): GateReport {
	const base = { id: "mta-sts-enforce", title: "MTA-STS → mode: enforce (#34)" };

	if (mtaSts.servedMode === "enforce") {
		return { ...base, status: "satisfied", detail: "policy is served as mode: enforce" };
	}

	if (mtaSts.servedMode === undefined) {
		return {
			...base,
			status: "blocked",
			detail: "the policy did not load from mta-sts.auditmos.com",
			nextStep: "Run `pnpm mta-sts:verify`; the policy Worker may be undeployed.",
		};
	}

	if (mtaSts.mxMatches === false) {
		return {
			...base,
			status: "blocked",
			detail: "the served policy's mx list disagrees with live MX records",
			nextStep:
				"Do **not** flip to enforce — under enforce this refuses inbound mail. " +
				"Run `pnpm mta-sts:verify` for the diff, fix MX_HOSTS, redeploy, bump the TXT id.",
		};
	}

	if (!mtaSts.txtId) {
		return {
			...base,
			status: "blocked",
			detail: "_mta-sts TXT has no id, so senders have no signal to re-fetch",
			nextStep: "Republish the TXT record with an id before changing the policy.",
		};
	}

	if (now < MTA_STS_ENFORCE_FROM) {
		return {
			...base,
			status: "waiting",
			detail: `soaking in testing; opens in ${daysBetween(now, MTA_STS_ENFORCE_FROM)} days`,
		};
	}

	return {
		...base,
		status: "due",
		detail: `testing since deploy, past the ${MTA_STS_ENFORCE_FROM.toISOString().slice(0, 10)} gate`,
		nextStep:
			"Confirm the TLS-RPT reports in dmarc@auditmos.com are clean, then flip " +
			"`MTA_STS_MODE` **and** bump the `_mta-sts` TXT id — one without the other does nothing.",
	};
}

/** DMARC: ready to leave `p=none`? */
function dmarcGate({ now, dmarc }: GateObservations): GateReport {
	const base = { id: "dmarc-quarantine", title: "DMARC → p=quarantine (#32)" };

	if (dmarc.policy === "quarantine" || dmarc.policy === "reject") {
		return { ...base, status: "satisfied", detail: `policy is p=${dmarc.policy}` };
	}

	if (!dmarc.policy) {
		return {
			...base,
			status: "blocked",
			detail: "no DMARC policy is published",
			nextStep: "The _dmarc TXT record is missing or unparseable — republish it.",
		};
	}

	if (now < DMARC_QUARANTINE_FROM) {
		return {
			...base,
			status: "waiting",
			detail: `p=none while reports accumulate; opens in ${daysBetween(now, DMARC_QUARANTINE_FROM)} days`,
		};
	}

	return {
		...base,
		status: "due",
		detail: `p=none, past the ${DMARC_QUARANTINE_FROM.toISOString().slice(0, 10)} gate`,
		nextStep:
			"Read the aggregate reports in dmarc@auditmos.com first — every legitimate sender " +
			"must pass SPF **or** DKIM with alignment. Then set p=quarantine.",
	};
}

/**
 * CAA: has a certificate actually renewed under the policy?
 *
 * A `dig` proves the records exist; only a leaf issued *after* they were
 * published proves they permit the CA that renews this zone. That is the whole
 * risk with CAA — too narrow a policy fails at renewal, silently, months later.
 */
function caaGate({ now, caa }: GateObservations): GateReport {
	const base = { id: "caa-renewal", title: "CAA proven by a renewal (#31)" };

	if (caa.records.length === 0) {
		return {
			...base,
			status: "blocked",
			detail: "no CAA records on the zone — the policy is gone",
			nextStep: "Republish; see the CAA section in docs/deployment.md.",
		};
	}

	if (!caa.leafNotBefore || !caa.leafNotAfter) {
		return {
			...base,
			status: "blocked",
			detail: "could not read the production certificate",
			nextStep: "Check that auditmos.com completes a TLS handshake.",
		};
	}

	if (caa.leafNotBefore > CAA_PUBLISHED_AT) {
		return {
			...base,
			status: "satisfied",
			detail:
				`leaf issued ${caa.leafNotBefore.toISOString().slice(0, 10)}, after the policy — ` +
				"a renewal has completed under CAA",
		};
	}

	const daysLeft = daysBetween(now, caa.leafNotAfter);

	if (daysLeft <= CAA_RENEWAL_ALARM_DAYS) {
		return {
			...base,
			status: "blocked",
			detail: `certificate expires in ${daysLeft} days and has not renewed since CAA was published`,
			nextStep:
				"Renewal may be blocked by the CAA policy. Compare the issuing CA against the " +
				"`issue`/`issuewild` values on the zone before the certificate lapses.",
		};
	}

	return {
		...base,
		status: "waiting",
		detail: `leaf predates the policy; ${daysLeft} days until renewal must have happened`,
	};
}

export function evaluateGates(observations: GateObservations): GateReport[] {
	return [mtaStsGate(observations), dmarcGate(observations), caaGate(observations)];
}

/** The gates a human has to look at. `satisfied` and `waiting` need nobody. */
export function gatesNeedingAttention(reports: readonly GateReport[]): GateReport[] {
	return reports.filter(({ status }) => status === "due" || status === "blocked");
}

const STATUS_MARK: Record<GateStatus, string> = {
	waiting: "⏳ waiting",
	due: "🔔 due",
	satisfied: "✅ satisfied",
	blocked: "⛔ blocked",
};

export function formatGateReport(reports: readonly GateReport[]): string {
	const rows = reports.map(
		({ title, status, detail }) => `| ${title} | ${STATUS_MARK[status]} | ${detail} |`,
	);
	const actions = reports
		.filter((report) => report.nextStep)
		.map((report) => `**${report.title}** — ${report.nextStep}`);

	return [
		"| Gate | Status | Observed |",
		"|------|--------|----------|",
		...rows,
		...(actions.length > 0 ? ["", "### Next steps", "", ...actions.map((a) => `- ${a}`)] : []),
		"",
	].join("\n");
}
