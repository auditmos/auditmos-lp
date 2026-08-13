/**
 * Report on the three deferred security changes, from live DNS and TLS.
 *
 *   pnpm security:gates
 *
 * Prints a table, and under GitHub Actions also writes the step summary and
 * sets outputs the workflow branches on. Exits 0 even when a gate is blocked:
 * the caller decides what to do about it, and a red cron every week trains
 * people to ignore it.
 *
 * **What this cannot see.** Both mail gates ultimately depend on reports
 * arriving in `dmarc@auditmos.com` — DMARC aggregates and TLS-RPT failures —
 * and nothing here has credentials for that mailbox, nor should it. So a `due`
 * gate means "the timer has elapsed and the machine-checkable preconditions
 * hold", never "the reports are clean". Reading them stays a human step, and
 * every `nextStep` says so.
 */

import { resolveCaa, resolveMx, resolveTxt } from "node:dns/promises";
import { appendFileSync } from "node:fs";
import { connect } from "node:tls";
import { compareMx, MTA_STS_POLICY_PATH, parsePolicyMxHosts } from "../src/mail/mta-sts";
import {
	evaluateGates,
	formatGateReport,
	type GateObservations,
	gatesNeedingAttention,
} from "./security-gates-lib";

const domain = process.argv[2] ?? "auditmos.com";

const observations: GateObservations = {
	now: new Date(),
	mtaSts: await observeMtaSts(domain),
	dmarc: await observeDmarc(domain),
	caa: await observeCaa(domain),
};

const reports = evaluateGates(observations);
const attention = gatesNeedingAttention(reports);
const table = formatGateReport(reports);

process.stdout.write(`Security gates — ${domain}\n\n${table}`);

if (process.env.GITHUB_STEP_SUMMARY) {
	appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Security gates\n\n${table}`);
}

if (process.env.GITHUB_OUTPUT) {
	const mtaSts = reports.find((report) => report.id === "mta-sts-enforce");

	appendFileSync(
		process.env.GITHUB_OUTPUT,
		`${[
			`needs_attention=${attention.length > 0}`,
			// The one gate whose repo-side change can be prepared automatically.
			// DMARC and CAA are DNS-only, so there is nothing to open a PR with.
			`mta_sts_due=${mtaSts?.status === "due"}`,
			"report<<GATES_EOF",
			table,
			"GATES_EOF",
		].join("\n")}\n`,
	);
}

async function observeMtaSts(host: string): Promise<GateObservations["mtaSts"]> {
	const [policy, txt, mx] = await Promise.all([
		fetch(`https://mta-sts.${host}${MTA_STS_POLICY_PATH}`, { redirect: "manual" })
			.then((response) => (response.ok ? response.text() : undefined))
			.catch(() => undefined),
		resolveTxt(`_mta-sts.${host}`).catch(() => []),
		resolveMx(host).catch(() => []),
	]);

	const record = txt.map((chunks) => chunks.join("")).find((value) => value.startsWith("v=STSv1"));

	return {
		servedMode: policy?.match(/^mode:\s*(\S+)/m)?.[1],
		txtId: record?.match(/\bid\s*=\s*([^;\s]+)/)?.[1],
		mxMatches:
			policy === undefined
				? undefined
				: compareMx(
						parsePolicyMxHosts(policy),
						mx.map((entry) => entry.exchange),
					).matches,
	};
}

async function observeDmarc(host: string): Promise<GateObservations["dmarc"]> {
	const txt = await resolveTxt(`_dmarc.${host}`).catch(() => []);
	const record = txt.map((chunks) => chunks.join("")).find((value) => value.startsWith("v=DMARC1"));

	return { policy: record?.match(/\bp\s*=\s*([^;\s]+)/)?.[1] };
}

async function observeCaa(host: string): Promise<GateObservations["caa"]> {
	const [records, leaf] = await Promise.all([
		resolveCaa(host).catch(() => []),
		readLeafCertificate(host),
	]);

	return {
		records: records.map((record) => JSON.stringify(record)),
		leafNotBefore: leaf?.notBefore,
		leafNotAfter: leaf?.notAfter,
	};
}

/** The served leaf's validity window — the only evidence a renewal happened. */
function readLeafCertificate(
	host: string,
): Promise<{ notBefore: Date; notAfter: Date } | undefined> {
	return new Promise((resolve) => {
		const socket = connect({ host, port: 443, servername: host }, () => {
			const certificate = socket.getPeerCertificate();
			socket.end();
			resolve(
				certificate.valid_from && certificate.valid_to
					? {
							notBefore: new Date(certificate.valid_from),
							notAfter: new Date(certificate.valid_to),
						}
					: undefined,
			);
		});

		socket.setTimeout(15_000, () => {
			socket.destroy();
			resolve(undefined);
		});
		socket.on("error", () => resolve(undefined));
	});
}
