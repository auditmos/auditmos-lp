type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface AuditReport {
	fileName: string;
	url: string;
	/** `YYYY-MM-DD` parsed from the filename, or null when it does not follow the convention. */
	publishedOn: string | null;
}

export interface AuditReportCache {
	read: () => Promise<AuditReport[] | null>;
	write: (reports: readonly AuditReport[]) => Promise<void>;
}

export interface AuditAggregatorDependencies {
	fetch: FetchLike;
	cache: AuditReportCache;
	token?: string;
	repository?: `${string}/${string}`;
	logger?: Pick<Console, "warn" | "error">;
}

interface GithubContentEntry {
	name: string;
	type: string;
	html_url: string;
}

const DEFAULT_REPOSITORY = "auditmos/audits";

/** Reports are published as `YYYY_MM_DD_CLIENT.pdf` at the repository root. */
const REPORT_DATE_PATTERN = /^(\d{4})_(\d{2})_(\d{2})_/;

class AuditFetchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AuditFetchError";
	}
}

function errorReason(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function toAuditReport(entry: GithubContentEntry): AuditReport | null {
	if (entry.type !== "file") return null;
	if (!entry.name.toLowerCase().endsWith(".pdf")) return null;

	const match = REPORT_DATE_PATTERN.exec(entry.name);

	return {
		fileName: entry.name,
		url: entry.html_url,
		publishedOn: match ? `${match[1]}-${match[2]}-${match[3]}` : null,
	};
}

// Newest first; undated reports sort last, then alphabetically for stability.
function compareAuditReport(a: AuditReport, b: AuditReport): number {
	if (a.publishedOn && b.publishedOn) {
		const dateCompare = b.publishedOn.localeCompare(a.publishedOn);
		if (dateCompare !== 0) return dateCompare;
	} else if (a.publishedOn) {
		return -1;
	} else if (b.publishedOn) {
		return 1;
	}

	return a.fileName.localeCompare(b.fileName);
}

function buildHeaders(token?: string): HeadersInit {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"User-Agent": "auditmos-lp",
		"X-GitHub-Api-Version": "2022-11-28",
	};

	if (token) headers.Authorization = `Bearer ${token}`;

	return headers;
}

/**
 * Lists the published audit reports — every PDF at the root of the audits repository.
 *
 * The homepage headline count derives from this, so the failure mode matters more than the
 * happy path: any error, including an empty listing, falls back to the last committed cache
 * rather than publishing a smaller number. An empty result is treated as a failure because a
 * repository that suddenly holds no reports is far more likely a moved repo or a changed API
 * shape than an actual retraction of every report.
 */
export async function fetchAuditReports(deps: AuditAggregatorDependencies): Promise<AuditReport[]> {
	const repository = deps.repository ?? DEFAULT_REPOSITORY;

	try {
		const response = await deps.fetch(`https://api.github.com/repos/${repository}/contents`, {
			headers: buildHeaders(deps.token),
		});

		if (!response.ok) {
			throw new AuditFetchError(`GitHub responded with ${response.status} for ${repository}`);
		}

		const entries = (await response.json()) as GithubContentEntry[];
		const reports = entries
			.map(toAuditReport)
			.filter((report): report is AuditReport => report !== null)
			.sort(compareAuditReport);

		if (reports.length === 0) {
			throw new AuditFetchError(`no audit reports found in ${repository}`);
		}

		await writeCacheSafely(reports, deps);
		return reports;
	} catch (error) {
		deps.logger?.warn("audit_reports_fallback", { repository, reason: errorReason(error) });

		const cached = await readCacheSafely(deps);
		return cached ?? [];
	}
}

async function readCacheSafely(deps: AuditAggregatorDependencies): Promise<AuditReport[] | null> {
	try {
		return await deps.cache.read();
	} catch (error) {
		deps.logger?.error("audit_cache_read_failed", { reason: errorReason(error) });
		return null;
	}
}

// A cache-write failure must never discard freshly fetched data or fail the build.
async function writeCacheSafely(
	reports: readonly AuditReport[],
	deps: AuditAggregatorDependencies,
): Promise<void> {
	try {
		await deps.cache.write(reports);
	} catch (error) {
		deps.logger?.error("audit_cache_write_failed", { reason: errorReason(error) });
	}
}
