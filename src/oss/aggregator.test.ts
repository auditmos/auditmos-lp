/**
 * TDD assumptions for issue #7:
 * - The tested public interface is `fetchOssProjects(deps)`.
 * - `fetch` and `cache` (read/write) are injected system boundaries; nothing else is mocked.
 * - GitHub org repos are read from `/orgs/<org>/repos`, paginated at 100 per page.
 * - This unit does not test the Astro page wrapper, the fs-backed cache, real GitHub calls,
 *   `process.env` token loading, or build output.
 */

import {
	fetchOssProjects,
	type OssAggregatorDependencies,
	type OssProject,
	type OssProjectCache,
} from "./aggregator";

interface GithubRepo {
	name: string;
	description: string | null;
	html_url: string;
	stargazers_count: number;
	language: string | null;
	updated_at: string;
	archived: boolean;
	fork: boolean;
}

function githubRepo(overrides: Partial<GithubRepo> = {}): GithubRepo {
	return {
		name: "audit-cli",
		description: "Command-line auditing helpers.",
		html_url: "https://github.com/auditmos/audit-cli",
		stargazers_count: 12,
		language: "TypeScript",
		updated_at: "2026-06-01T00:00:00Z",
		archived: false,
		fork: false,
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

function stubCache(overrides: Partial<OssProjectCache> = {}): OssProjectCache {
	return {
		read: vi.fn<OssProjectCache["read"]>().mockResolvedValue(null),
		write: vi.fn<OssProjectCache["write"]>().mockResolvedValue(undefined),
		...overrides,
	};
}

describe("fetchOssProjects", () => {
	it("maps a successful repo list to typed OssProject records", async () => {
		const fetch = vi.fn<OssAggregatorDependencies["fetch"]>().mockResolvedValue(
			jsonResponse([
				githubRepo({
					name: "audit-cli",
					description: "Command-line auditing helpers.",
					html_url: "https://github.com/auditmos/audit-cli",
					stargazers_count: 42,
					language: "TypeScript",
					updated_at: "2026-06-01T00:00:00Z",
				}),
			]),
		);

		const result = await fetchOssProjects({ fetch, cache: stubCache() });

		expect(result).toEqual<OssProject[]>([
			{
				name: "audit-cli",
				description: "Command-line auditing helpers.",
				url: "https://github.com/auditmos/audit-cli",
				stars: 42,
				language: "TypeScript",
				updatedAt: "2026-06-01T00:00:00Z",
			},
		]);
	});

	it("excludes archived and fork repos and sorts by updatedAt desc, tie-breaking on stars then name", async () => {
		const fetch = vi.fn<OssAggregatorDependencies["fetch"]>().mockResolvedValue(
			jsonResponse([
				githubRepo({
					name: "archived-thing",
					archived: true,
					updated_at: "2027-01-01T00:00:00Z",
				}),
				githubRepo({ name: "forked-thing", fork: true, updated_at: "2027-01-01T00:00:00Z" }),
				githubRepo({ name: "older", updated_at: "2026-01-01T00:00:00Z", stargazers_count: 100 }),
				githubRepo({ name: "newer", updated_at: "2026-06-01T00:00:00Z", stargazers_count: 1 }),
				githubRepo({ name: "tie-high", updated_at: "2026-06-01T00:00:00Z", stargazers_count: 9 }),
				githubRepo({ name: "alpha", updated_at: "2026-06-01T00:00:00Z", stargazers_count: 9 }),
			]),
		);

		const result = await fetchOssProjects({ fetch, cache: stubCache() });

		expect(result.map((project) => project.name)).toEqual(["alpha", "tie-high", "newer", "older"]);
	});

	it("includes archived and fork repos when configured", async () => {
		const fetch = vi.fn<OssAggregatorDependencies["fetch"]>().mockResolvedValue(
			jsonResponse([
				githubRepo({
					name: "archived-thing",
					archived: true,
					updated_at: "2027-01-01T00:00:00Z",
				}),
				githubRepo({ name: "forked-thing", fork: true, updated_at: "2026-12-01T00:00:00Z" }),
				githubRepo({ name: "active", updated_at: "2026-06-01T00:00:00Z" }),
			]),
		);

		const result = await fetchOssProjects({
			fetch,
			cache: stubCache(),
			includeArchived: true,
			includeForks: true,
		});

		expect(result.map((project) => project.name)).toEqual([
			"archived-thing",
			"forked-thing",
			"active",
		]);
	});

	it("follows pagination until a short page and merges every repo", async () => {
		const firstPage = Array.from({ length: 100 }, (_, index) =>
			githubRepo({ name: `repo-${index}` }),
		);
		const secondPage = Array.from({ length: 3 }, (_, index) =>
			githubRepo({ name: `repo-${100 + index}` }),
		);
		const fetch = vi
			.fn<OssAggregatorDependencies["fetch"]>()
			.mockResolvedValueOnce(jsonResponse(firstPage))
			.mockResolvedValueOnce(jsonResponse(secondPage));

		const result = await fetchOssProjects({ fetch, cache: stubCache() });

		expect(result).toHaveLength(103);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(String(fetch.mock.calls[0]?.[0])).toContain("page=1");
		expect(String(fetch.mock.calls[1]?.[0])).toContain("page=2");
	});

	it("sends an Authorization header only when a token is provided", async () => {
		const fetch = vi
			.fn<OssAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse([githubRepo()]));

		await fetchOssProjects({ fetch, cache: stubCache(), token: "ghp_secret" });

		const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
		expect(headers.get("Authorization")).toBe("Bearer ghp_secret");
	});

	it("omits the Authorization header when no token is provided", async () => {
		const fetch = vi
			.fn<OssAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse([githubRepo()]));

		await fetchOssProjects({ fetch, cache: stubCache() });

		const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
		expect(headers.has("Authorization")).toBe(false);
	});

	const cachedProjects: OssProject[] = [
		{
			name: "cached-repo",
			description: "Last known good result.",
			url: "https://github.com/auditmos/cached-repo",
			stars: 3,
			language: "Go",
			updatedAt: "2026-05-01T00:00:00Z",
		},
	];

	it.each([
		["a 5xx response", () => Promise.resolve(jsonResponse({}, { status: 500 }))],
		["a rate-limited 403 response", () => Promise.resolve(jsonResponse({}, { status: 403 }))],
		["a network error", () => Promise.reject(new TypeError("network down"))],
	])("falls back to cached projects and warns on %s", async (_case, respond) => {
		const fetch = vi.fn<OssAggregatorDependencies["fetch"]>().mockImplementation(respond);
		const cache = stubCache({
			read: vi.fn<OssProjectCache["read"]>().mockResolvedValue(cachedProjects),
		});
		const logger = { warn: vi.fn(), error: vi.fn() };

		const result = await fetchOssProjects({ fetch, cache, logger });

		expect(result).toEqual(cachedProjects);
		expect(cache.read).toHaveBeenCalled();
		expect(logger.warn).toHaveBeenCalled();
	});

	it("returns an empty list when the API fails and no cache exists", async () => {
		const fetch = vi
			.fn<OssAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse({}, { status: 500 }));
		const cache = stubCache({
			read: vi.fn<OssProjectCache["read"]>().mockResolvedValue(null),
		});

		const result = await fetchOssProjects({ fetch, cache });

		expect(result).toEqual([]);
	});

	it("returns an empty list when the API fails and the cache is unreadable", async () => {
		const fetch = vi
			.fn<OssAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse({}, { status: 500 }));
		const cache = stubCache({
			read: vi.fn<OssProjectCache["read"]>().mockRejectedValue(new Error("cache file missing")),
		});

		const result = await fetchOssProjects({ fetch, cache });

		expect(result).toEqual([]);
	});

	it("returns an empty list on a 404 without falling back to cache or warning", async () => {
		const fetch = vi
			.fn<OssAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse({ message: "Not Found" }, { status: 404 }));
		const cache = stubCache();
		const logger = { warn: vi.fn(), error: vi.fn() };

		const result = await fetchOssProjects({ fetch, cache, logger });

		expect(result).toEqual([]);
		expect(cache.read).not.toHaveBeenCalled();
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it("writes the mapped projects to the cache after a successful fetch", async () => {
		const fetch = vi
			.fn<OssAggregatorDependencies["fetch"]>()
			.mockResolvedValue(
				jsonResponse([
					githubRepo({ name: "older", updated_at: "2026-01-01T00:00:00Z" }),
					githubRepo({ name: "newer", updated_at: "2026-07-01T00:00:00Z" }),
				]),
			);
		const cache = stubCache();

		const result = await fetchOssProjects({ fetch, cache });

		expect(cache.write).toHaveBeenCalledTimes(1);
		expect(cache.write).toHaveBeenCalledWith(result);
		expect(result.map((project) => project.name)).toEqual(["newer", "older"]);
	});

	it("does not write the cache when the API fails", async () => {
		const fetch = vi
			.fn<OssAggregatorDependencies["fetch"]>()
			.mockResolvedValue(jsonResponse({}, { status: 500 }));
		const cache = stubCache({
			read: vi.fn<OssProjectCache["read"]>().mockResolvedValue(cachedProjects),
		});

		await fetchOssProjects({ fetch, cache });

		expect(cache.write).not.toHaveBeenCalled();
	});
});
