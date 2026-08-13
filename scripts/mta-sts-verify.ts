/**
 * Check the deployed MTA-STS policy against the zone it claims to describe.
 *
 *   pnpm mta-sts:verify
 *
 * Three facts, none of which any build artifact can hold:
 *
 * 1. the `_mta-sts` TXT record exists and carries an `id`, which is the only
 *    signal senders have to re-fetch a policy they cached for `max_age`;
 * 2. the policy is reachable over HTTPS with `content-type: text/plain`, no
 *    redirect, from a certificate valid for the MTA-STS host;
 * 3. its `mx:` list matches the live MX records **exactly** — the failure that
 *    blocks inbound mail once the policy leaves `testing`.
 *
 * Exits non-zero on any of them, so it can gate the flip to `mode: enforce`.
 */

import { resolveMx, resolveTxt } from "node:dns/promises";
import {
	compareMx,
	MTA_STS_MODE,
	MTA_STS_POLICY_PATH,
	parsePolicyMxHosts,
} from "../src/mail/mta-sts";

const domain = process.argv[2] ?? "auditmos.com";
const policyUrl = `https://mta-sts.${domain}${MTA_STS_POLICY_PATH}`;
const failures: string[] = [];

process.stdout.write(`MTA-STS — ${domain}\n\n`);

const txt = await resolveTxt(`_mta-sts.${domain}`).catch(() => []);
const stsRecords = txt.map((chunks) => chunks.join("")).filter((r) => r.startsWith("v=STSv1"));
const id = stsRecords[0]?.match(/\bid\s*=\s*([^;\s]+)/)?.[1];

if (stsRecords.length !== 1 || !id) {
	failures.push(`_mta-sts.${domain} must publish exactly one v=STSv1 record with an id`);
	process.stdout.write(`  FAILED     TXT: ${stsRecords.length} record(s), id=${id ?? "none"}\n`);
} else {
	process.stdout.write(`  OK         TXT id=${id}\n`);
}

// `redirect: "manual"` because RFC 8461 §3.3 forbids senders from following
// redirects here: a 301 that a browser would hide makes the policy unfetchable.
const response = await fetch(policyUrl, { redirect: "manual" }).catch((error: Error) => error);

if (response instanceof Error) {
	failures.push(`${policyUrl} did not load: ${response.message}`);
	process.stdout.write(`  FAILED     fetch: ${response.message}\n`);
} else if (response.status !== 200) {
	failures.push(`${policyUrl} answered ${response.status}, expected 200 with no redirect`);
	process.stdout.write(`  FAILED     status ${response.status}\n`);
} else {
	const contentType = response.headers.get("content-type") ?? "";

	if (!contentType.startsWith("text/plain")) {
		failures.push(`policy served as "${contentType}", expected text/plain`);
		process.stdout.write(`  FAILED     content-type ${contentType}\n`);
	} else {
		process.stdout.write(`  OK         200 ${contentType}\n`);
	}

	const policy = await response.text();
	const mode = policy.match(/^mode:\s*(\S+)/m)?.[1];

	if (mode !== MTA_STS_MODE) {
		failures.push(`served policy is mode: ${mode}, this checkout expects ${MTA_STS_MODE}`);
		process.stdout.write(`  FAILED     mode ${mode} — deployed policy is not this checkout\n`);
	} else {
		process.stdout.write(`  OK         mode: ${mode}\n`);
	}

	const mx = await resolveMx(domain).catch(() => []);
	const comparison = compareMx(
		parsePolicyMxHosts(policy),
		mx.map((record) => record.exchange),
	);

	if (comparison.matches) {
		process.stdout.write(`  OK         mx list matches all ${mx.length} live MX records\n`);
	} else {
		failures.push("policy mx list does not match live MX records");
		for (const host of comparison.missingFromPolicy) {
			process.stdout.write(`  FAILED     ${host} is an MX but the policy omits it\n`);
		}
		for (const host of comparison.unexpectedInPolicy) {
			process.stdout.write(`  FAILED     ${host} is in the policy but is not an MX\n`);
		}
	}
}

if (failures.length > 0) {
	console.error(
		`\n${failures.length} problem(s). Under "mode: enforce" an MX mismatch refuses inbound mail,\n` +
			"so fix these before flipping the mode — and bump the TXT id when you do.",
	);
	process.exit(1);
}

process.stdout.write("\n  Policy, DNS and MX agree.\n");
