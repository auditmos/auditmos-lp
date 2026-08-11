/**
 * Pure helpers for `pnpm csp:violations`.
 *
 * The Worker logs each Content Security Policy violation as a structured
 * `csp_violation` warning (`src/csp/report-handler.ts`). This turns the raw
 * `wrangler tail` stream into those violations and nothing else.
 *
 * The spawn and the stream wiring live in `csp-violations.ts`; everything here
 * is testable without a network or a subprocess.
 */

export interface SplitRecords {
	/** Complete JSON objects, ready to parse. */
	records: string[];
	/** The trailing fragment, to be prepended to the next chunk. */
	rest: string;
}

/**
 * Carve complete JSON objects out of a stream buffer.
 *
 * `wrangler tail --format json` pretty-prints each event across many lines
 * instead of emitting newline-delimited JSON, so a line-at-a-time reader only
 * ever sees fragments. Depth-counting finds the boundaries, and it has to skip
 * over string literals: `blockedUri` comes straight from the report body and
 * `user-agent` from the caller, so an unbalanced brace in either is reachable
 * by anyone — and one of those would close a record early and leave the
 * splitter out of sync with the stream for the rest of the watch.
 */
interface ScanState {
	inString: boolean;
	escaped: boolean;
}

/**
 * Advance the string-literal state, and report whether this character counts
 * towards object depth. Everything inside a string, and every escape, does not.
 */
function isStructural(char: string, state: ScanState): boolean {
	if (state.escaped) {
		state.escaped = false;
		return false;
	}
	if (char === "\\") {
		state.escaped = true;
		return false;
	}
	if (char === '"') {
		state.inString = !state.inString;
		return false;
	}

	return !state.inString;
}

export function splitJsonRecords(buffer: string): SplitRecords {
	const records: string[] = [];
	const state: ScanState = { inString: false, escaped: false };
	let depth = 0;
	let start = -1;

	for (let index = 0; index < buffer.length; index++) {
		const char = buffer[index] ?? "";
		if (!isStructural(char, state)) continue;

		if (char === "{") {
			if (depth === 0) start = index;
			depth++;
		} else if (char === "}" && depth > 0 && --depth === 0) {
			records.push(buffer.slice(start, index + 1));
			start = -1;
		}
	}

	return { records, rest: start === -1 ? "" : buffer.slice(start) };
}

/** The bounded projection the report handler logs. */
export interface CspViolation {
	blockedUri: string;
	documentUri: string;
	effectiveDirective: string;
	violatedDirective: string;
}

/** The marker the handler logs alongside the fields. */
const VIOLATION_MESSAGE = "csp_violation";

interface TailRecord {
	logs?: { message?: unknown[] }[];
}

function asViolation(value: unknown): CspViolation | undefined {
	if (typeof value !== "object" || value === null) return undefined;

	const fields = value as Record<string, unknown>;
	const text = (key: string): string =>
		typeof fields[key] === "string" ? (fields[key] as string) : "";

	return {
		blockedUri: text("blockedUri"),
		documentUri: text("documentUri"),
		effectiveDirective: text("effectiveDirective"),
		violatedDirective: text("violatedDirective"),
	};
}

/**
 * The violations a tail record carries, if any.
 *
 * A record that is not valid JSON yields none rather than throwing: wrangler
 * interleaves its own banner lines with the stream, and one of those must not
 * end a watch that is meant to run for a week.
 */
export function violationsIn(record: string): CspViolation[] {
	let parsed: TailRecord;

	try {
		parsed = JSON.parse(record) as TailRecord;
	} catch {
		return [];
	}

	return (parsed.logs ?? [])
		.filter((log) => log.message?.[0] === VIOLATION_MESSAGE)
		.map((log) => asViolation(log.message?.[1]))
		.filter((violation): violation is CspViolation => violation !== undefined);
}

/** One violation, as printed the moment it arrives. */
export function formatViolation(violation: CspViolation): string {
	return `${violation.effectiveDirective || violation.violatedDirective} blocked ${violation.blockedUri} on ${violation.documentUri}`;
}

/**
 * What the watch actually produced, grouped so the first line is the one to act
 * on. Each group names the pages it fired on, because the directive says what
 * was refused and the page says where to go fix it.
 */
export function formatSummary(violations: readonly CspViolation[]): string {
	if (violations.length === 0) {
		return "No violations seen.";
	}

	const groups = new Map<string, { count: number; pages: Set<string> }>();

	for (const violation of violations) {
		const key = `${violation.effectiveDirective || violation.violatedDirective} ${violation.blockedUri}`;
		const group = groups.get(key) ?? { count: 0, pages: new Set<string>() };

		group.count++;
		if (violation.documentUri) group.pages.add(violation.documentUri);
		groups.set(key, group);
	}

	const rows = [...groups.entries()]
		.sort(([, a], [, b]) => b.count - a.count)
		.map(([key, group]) => `  ${group.count} × ${key}\n      on ${[...group.pages].join(", ")}`);

	return [`${violations.length} violations, ${groups.size} distinct:`, "", ...rows].join("\n");
}
