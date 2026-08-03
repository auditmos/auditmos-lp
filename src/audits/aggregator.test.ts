/**
 * Assumptions:
 * - The tested public interface is `fetchAuditReports(deps)`.
 * - `fetch` and `cache` (read/write) are injected system boundaries; nothing else is mocked.
 * - Reports are the PDFs at the root of the audits repository, read from
 *   `/repos/<owner>/<repo>/contents`, named `YYYY_MM_DD_CLIENT.pdf`.
 * - This unit does not test the Astro page wrapper, the fs-backed cache, real GitHub calls,
 *   `process.env` token loading, or build output.
 */

import {
	type AuditAggregatorDependencies,
	type AuditReport,
	type AuditReportCache,
	fetchAuditReports,
} from "./aggregator";

interface GithubContentEntry {
	name: string;
	type: string;
	html_url: string;
}

function contentEntry(
	name: string,
	overrides: Partial<GithubContentEntry> = {},
): GithubContentEntry {
	return {
		name,
		type: "file",
		html_url: `https://github.com/auditmos/audits/blob/main/${name}`,
		...overrides,
	};
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
		...init,
	});
}

function stubCache(overrides: Partial<AuditReportCache> = {}): AuditReportCache {
	return {
		read: vi.fn<AuditReportCache["read"]>().mockResolvedValue(null),
		write: vi.fn<AuditReportCache["write"]>().mockResolvedValue(undefined),
		...overrides,
	};
}

const cachedReports: AuditReport[] = [
	{
		fileName: "2021_08_21_STARTERRA.pdf",
		url: "https://github.com/auditmos/audits/blob/main/2021_08_21_STARTERRA.pdf",
		publishedOn: "2021-08-21",
	},
];

describe("fetchAuditReports", () => {
	it("maps every root PDF to a typed report with the date parsed from its filename", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse([contentEntry("2021_08_21_STARTERRA.pdf")]));

		const result = await fetchAuditReports({ fetch, cache: stubCache() });

		expect(result).toEqual<AuditReport[]>([
			{
				fileName: "2021_08_21_STARTERRA.pdf",
				url: "https://github.com/auditmos/audits/blob/main/2021_08_21_STARTERRA.pdf",
				publishedOn: "2021-08-21",
			},
		]);
	});

	it("reads the audits repository root by default", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse([contentEntry("2021_08_21_STARTERRA.pdf")]));

		await fetchAuditReports({ fetch, cache: stubCache() });

		expect(String(fetch.mock.calls[0]?.[0])).toBe(
			"https://api.github.com/repos/auditmos/audits/contents",
		);
	});

	it("counts only PDFs, ignoring directories and other files", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(
				jsonResponse([
					contentEntry("2021_08_21_STARTERRA.pdf"),
					contentEntry("2022_01_24_KUJIRA_ORCA.pdf"),
					contentEntry("README.md"),
					contentEntry("LICENSE"),
					contentEntry("archive", { type: "dir" }),
					contentEntry("2023_06_23_GAMESWIFT.pdf", { type: "dir" }),
				]),
			);

		const result = await fetchAuditReports({ fetch, cache: stubCache() });

		expect(result.map((report) => report.fileName)).toEqual([
			"2022_01_24_KUJIRA_ORCA.pdf",
			"2021_08_21_STARTERRA.pdf",
		]);
	});

	it("sorts newest first, placing undated reports last", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(
				jsonResponse([
					contentEntry("2021_08_21_STARTERRA.pdf"),
					contentEntry("UNDATED_REPORT.pdf"),
					contentEntry("2025_07_30_STARGATE_FINANCE_LOCKER.pdf"),
					contentEntry("2023_06_23_GAMESWIFT.pdf"),
				]),
			);

		const result = await fetchAuditReports({ fetch, cache: stubCache() });

		expect(result.map((report) => report.fileName)).toEqual([
			"2025_07_30_STARGATE_FINANCE_LOCKER.pdf",
			"2023_06_23_GAMESWIFT.pdf",
			"2021_08_21_STARTERRA.pdf",
			"UNDATED_REPORT.pdf",
		]);
	});

	it("keeps a PDF that does not follow the naming convention, with a null date", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse([contentEntry("SPECIAL_REVIEW.pdf")]));

		const result = await fetchAuditReports({ fetch, cache: stubCache() });

		expect(result).toHaveLength(1);
		expect(result[0]?.publishedOn).toBeNull();
	});

	it("matches a .PDF extension regardless of case", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse([contentEntry("2024_02_26_STARHEROES.PDF")]));

		const result = await fetchAuditReports({ fetch, cache: stubCache() });

		expect(result).toHaveLength(1);
	});

	it("sends an Authorization header only when a token is provided", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse([contentEntry("2021_08_21_STARTERRA.pdf")]));

		await fetchAuditReports({ fetch, cache: stubCache(), token: "ghp_secret" });

		const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
		expect(headers.get("Authorization")).toBe("Bearer ghp_secret");
	});

	it("omits the Authorization header when no token is provided", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse([contentEntry("2021_08_21_STARTERRA.pdf")]));

		await fetchAuditReports({ fetch, cache: stubCache() });

		const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
		expect(headers.has("Authorization")).toBe(false);
	});

	it.each([
		["a 5xx response", 500],
		["a rate-limited 403 response", 403],
		["a 404 response", 404],
	])("falls back to cached reports and warns on %s", async (_case, status) => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse({}, { status }));
		const cache = stubCache({
			read: vi.fn<AuditReportCache["read"]>().mockResolvedValue(cachedReports),
		});
		const logger = { warn: vi.fn(), error: vi.fn() };

		const result = await fetchAuditReports({ fetch, cache, logger });

		expect(result).toEqual(cachedReports);
		expect(logger.warn).toHaveBeenCalled();
	});

	it("falls back to cached reports on a network error", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockRejectedValue(new TypeError("network down"));
		const cache = stubCache({
			read: vi.fn<AuditReportCache["read"]>().mockResolvedValue(cachedReports),
		});

		const result = await fetchAuditReports({ fetch, cache });

		expect(result).toEqual(cachedReports);
	});

	it("treats an empty listing as a failure rather than publishing a zero count", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse([contentEntry("README.md")]));
		const cache = stubCache({
			read: vi.fn<AuditReportCache["read"]>().mockResolvedValue(cachedReports),
		});

		const result = await fetchAuditReports({ fetch, cache });

		expect(result).toEqual(cachedReports);
		expect(cache.write).not.toHaveBeenCalled();
	});

	it("returns an empty list when the API fails and no cache exists", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse({}, { status: 500 }));

		const result = await fetchAuditReports({ fetch, cache: stubCache() });

		expect(result).toEqual([]);
	});

	it("returns an empty list when the API fails and the cache is unreadable", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse({}, { status: 500 }));
		const cache = stubCache({
			read: vi.fn<AuditReportCache["read"]>().mockRejectedValue(new Error("cache file missing")),
		});

		const result = await fetchAuditReports({ fetch, cache });

		expect(result).toEqual([]);
	});

	it("writes the mapped reports to the cache after a successful fetch", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(
				jsonResponse([
					contentEntry("2021_08_21_STARTERRA.pdf"),
					contentEntry("2023_06_23_GAMESWIFT.pdf"),
				]),
			);
		const cache = stubCache();

		const result = await fetchAuditReports({ fetch, cache });

		expect(cache.write).toHaveBeenCalledTimes(1);
		expect(cache.write).toHaveBeenCalledWith(result);
	});

	it("does not write the cache when the API fails", async () => {
		const fetch = vi
			.fn<AuditAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse({}, { status: 500 }));
		const cache = stubCache({
			read: vi.fn<AuditReportCache["read"]>().mockResolvedValue(cachedReports),
		});

		await fetchAuditReports({ fetch, cache });

		expect(cache.write).not.toHaveBeenCalled();
	});
});
