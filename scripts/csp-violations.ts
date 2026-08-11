/**
 * Watch a deployed environment for Content Security Policy violations.
 *
 *   pnpm csp:violations              # production
 *   pnpm csp:violations staging      # any configured env
 *
 * The policy ships report-only (`CSP_MODE` in
 * `src/site/content-security-policy.ts`). Browsers post what they *would* have
 * refused to `/api/csp-report`, the Worker logs each one as a structured
 * `csp_violation` warning, and this surfaces those and nothing else — the raw
 * tail is mostly ordinary request lines.
 *
 * **This observes from the moment it starts.** `wrangler tail` is a live
 * stream, not a query over history, so a quiet run proves only that the window
 * it was open was quiet. That distinction decides whether it is safe to
 * enforce, which is why the banner and the summary both state the window
 * rather than leaving "no output" to be read as "no violations ever". For the
 * week as a whole, query Workers Logs in the dashboard.
 *
 * Ctrl-C prints the summary. Parsing lives in `csp-violations-lib.ts`.
 */

import { execa } from "execa";
import {
	type CspViolation,
	formatSummary,
	formatViolation,
	splitJsonRecords,
	violationsIn,
} from "./csp-violations-lib";

const targetEnv = process.argv[2] ?? "production";
const seen: CspViolation[] = [];
const startedAt = Date.now();

function elapsed(): string {
	const seconds = Math.round((Date.now() - startedAt) / 1000);
	if (seconds < 60) return `${seconds}s`;

	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function report(): void {
	console.log(`\n\nWatched ${targetEnv} for ${elapsed()}.`);
	console.log(formatSummary(seen));
	console.log(
		"\nThis covers only the window above — `wrangler tail` streams live and\n" +
			"cannot see what happened before it started. For the whole report-only\n" +
			"period, query Workers Logs in the Cloudflare dashboard.",
	);
}

console.log(`Watching ${targetEnv} for CSP violations. Ctrl-C to stop and summarise.\n`);

const tail = execa("pnpm", ["exec", "wrangler", "tail", "--env", targetEnv, "--format", "json"], {
	buffer: false,
	reject: false,
});

let pending = "";

tail.stdout?.on("data", (chunk: Buffer) => {
	const { records, rest } = splitJsonRecords(pending + chunk.toString());
	pending = rest;

	for (const record of records) {
		for (const violation of violationsIn(record)) {
			seen.push(violation);
			console.log(`${new Date().toISOString()}  ${formatViolation(violation)}`);
		}
	}
});

// wrangler writes its connection banner and any auth error to stderr; passing
// it through is what makes a failed tail legible instead of silently quiet.
tail.stderr?.pipe(process.stderr);

// SIGTERM as well as SIGINT: a watch meant to run for days is as likely to be
// ended by a supervisor or a closing terminal as by Ctrl-C, and a summary that
// only prints for one of those is a summary you cannot rely on.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		report();
		tail.kill();
		process.exit(0);
	});
}

const result = await tail;

// Reached when wrangler exits on its own — an expired tail, a dropped
// connection, or a bad env name. Summarise rather than vanish.
report();

if (result.exitCode !== 0) {
	console.error(`\nwrangler tail exited with ${result.exitCode}.`);
	process.exit(1);
}
