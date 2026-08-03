import cached from "../../.cache/audit-reports.json";
import type { AuditReport } from "./aggregator";

/**
 * The published audit-report facts quoted across the site. Statically imported from the
 * repo-committed cache that `scripts/refresh-audits-cache.ts` regenerates before every build,
 * so prerendered pages perform no network or filesystem work.
 *
 * Every claim about the number of public reports reads `count` from here. The figure appears
 * in eleven places across the homepage, service pages, metadata, and the markdown mirror —
 * hand-writing it in any of them reintroduces the drift this module exists to prevent.
 */

/** Historical fact: the first public Auditmos report was published in 2021. */
const FIRST_REPORT_YEAR = 2021;

const reports = cached as AuditReport[];

function toEarliestYear(list: readonly AuditReport[]): number {
	const years = list
		.map((report) => report.publishedOn)
		.filter((publishedOn): publishedOn is string => publishedOn !== null)
		.map((publishedOn) => Number.parseInt(publishedOn.slice(0, 4), 10));

	return years.length > 0 ? Math.min(...years) : FIRST_REPORT_YEAR;
}

export const auditReports = {
	count: reports.length,
	earliestYear: toEarliestYear(reports),
} as const;
