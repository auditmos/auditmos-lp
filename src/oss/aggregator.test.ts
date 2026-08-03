/**
 * TDD assumptions for issue #7 (revised for the curated repository list):
 * - The tested public interface is `fetchOssProjects(deps)`.
 * - `fetch` and `cache` (read/write) are injected system boundaries; nothing else is mocked.
 * - Repositories are read one by one from `/repos/<owner>/<repo>`; membership comes from the
 *   injected `repositories` list, not from enumerating a GitHub organization.
 * - This unit does not test the Astro page wrapper, the fs-backed cache, real GitHub calls,
 *   `process.env` token loading, or build output.
 */

import {
	fetchOssProjects,
	type OssAggregatorDependencies,
	type OssProject,
	type OssProjectCache,
} from "./aggregator";
import { OSS_REPOSITORIES, type RepositoryPath } from "./repositories";

interface GithubRepo {
	full_name: string;
	description: string | null;
	html_url: string;
	stargazers_count: number;
	language: string | null;
	updated_at: string;
}

function githubRepo(overrides: Partial<GithubRepo> = {}): GithubRepo {
	return {
		full_name: "auditmos/audit-cli",
		description: "Command-line auditing helpers.",
		html_url: "https://github.com/auditmos/audit-cli",
		stargazers_count: 12,
		language: "TypeScript",
		updated_at: "2026-06-01T00:00:00Z",
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

/** Serves each `owner/repo` from a lookup table, 404-ing anything absent. */
function stubGithub(byPath: Record<string, GithubRepo | number>) {
	return vi.fn<OssAggregatorDependencies["fetch"]>().mockImplementation((input) => {
		const path = String(input).replace("https://api.github.com/repos/", "");
		const entry = byPath[path];

		if (entry === undefined) return Promise.resolve(jsonResponse({}, { status: 404 }));
		if (typeof entry === "number") return Promise.resolve(jsonResponse({}, { status: entry }));

		return Promise.resolve(jsonResponse(entry));
	});
}

describe("fetchOssProjects", () => {
	it("maps a listed repository to a typed OssProject record", async () => {
		const fetch = stubGithub({
			"auditmos/audit-cli": githubRepo({ stargazers_count: 42 }),
		});

		const result = await fetchOssProjects({
			fetch,
			cache: stubCache(),
			repositories: ["auditmos/audit-cli"],
		});

		expect(result).toEqual<OssProject[]>([
			{
				fullName: "auditmos/audit-cli",
				description: "Command-line auditing helpers.",
				url: "https://github.com/auditmos/audit-cli",
				stars: 42,
				language: "TypeScript",
				updatedAt: "2026-06-01T00:00:00Z",
			},
		]);
	});

	it("requests exactly the listed repositories, one call each", async () => {
		const fetch = stubGithub({
			"auditmos/signmos": githubRepo({ full_name: "auditmos/signmos" }),
			"tkowalczyk/wizytowka-link": githubRepo({ full_name: "tkowalczyk/wizytowka-link" }),
		});

		await fetchOssProjects({
			fetch,
			cache: stubCache(),
			repositories: ["auditmos/signmos", "tkowalczyk/wizytowka-link"],
		});

		expect(fetch.mock.calls.map((call) => String(call[0]))).toEqual([
			"https://api.github.com/repos/auditmos/signmos",
			"https://api.github.com/repos/tkowalczyk/wizytowka-link",
		]);
	});

	it("counts repositories from any owner, not just one organization", async () => {
		const fetch = stubGithub({
			"auditmos/signmos": githubRepo({ full_name: "auditmos/signmos" }),
			"tkowalczyk/wizytowka-link": githubRepo({ full_name: "tkowalczyk/wizytowka-link" }),
		});

		const result = await fetchOssProjects({
			fetch,
			cache: stubCache(),
			repositories: ["auditmos/signmos", "tkowalczyk/wizytowka-link"],
		});

		expect(result.map((project) => project.fullName).sort()).toEqual([
			"auditmos/signmos",
			"tkowalczyk/wizytowka-link",
		]);
	});

	it("sorts by updatedAt desc, tie-breaking on stars then full name", async () => {
		const fetch = stubGithub({
			"auditmos/older": githubRepo({
				full_name: "auditmos/older",
				updated_at: "2026-01-01T00:00:00Z",
				stargazers_count: 100,
			}),
			"auditmos/newer": githubRepo({
				full_name: "auditmos/newer",
				updated_at: "2026-06-01T00:00:00Z",
				stargazers_count: 1,
			}),
			"auditmos/tie-high": githubRepo({
				full_name: "auditmos/tie-high",
				updated_at: "2026-06-01T00:00:00Z",
				stargazers_count: 9,
			}),
			"auditmos/alpha": githubRepo({
				full_name: "auditmos/alpha",
				updated_at: "2026-06-01T00:00:00Z",
				stargazers_count: 9,
			}),
		});

		const result = await fetchOssProjects({
			fetch,
			cache: stubCache(),
			repositories: ["auditmos/older", "auditmos/newer", "auditmos/tie-high", "auditmos/alpha"],
		});

		expect(result.map((project) => project.fullName)).toEqual([
			"auditmos/alpha",
			"auditmos/tie-high",
			"auditmos/newer",
			"auditmos/older",
		]);
	});

	it("keeps an archived or forked repository that was listed explicitly", async () => {
		const fetch = stubGithub({
			"auditmos/archived-on-purpose": githubRepo({
				full_name: "auditmos/archived-on-purpose",
			}),
		});

		const result = await fetchOssProjects({
			fetch,
			cache: stubCache(),
			repositories: ["auditmos/archived-on-purpose"],
		});

		expect(result.map((project) => project.fullName)).toEqual(["auditmos/archived-on-purpose"]);
	});

	it("skips a repository GitHub will not serve publicly and warns, keeping the rest", async () => {
		const fetch = stubGithub({
			"auditmos/live": githubRepo({ full_name: "auditmos/live" }),
			// auditmos/renamed is absent, so the stub answers 404.
		});
		const cache = stubCache();
		const logger = { warn: vi.fn(), error: vi.fn() };

		const result = await fetchOssProjects({
			fetch,
			cache,
			logger,
			repositories: ["auditmos/live", "auditmos/renamed"],
		});

		expect(result.map((project) => project.fullName)).toEqual(["auditmos/live"]);
		expect(cache.read).not.toHaveBeenCalled();
		expect(logger.warn).toHaveBeenCalledWith("oss_repository_unavailable", {
			repository: "auditmos/renamed",
		});
	});

	it("sends an Authorization header only when a token is provided", async () => {
		const fetch = stubGithub({ "auditmos/audit-cli": githubRepo() });

		await fetchOssProjects({
			fetch,
			cache: stubCache(),
			token: "ghp_secret",
			repositories: ["auditmos/audit-cli"],
		});

		const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
		expect(headers.get("Authorization")).toBe("Bearer ghp_secret");
	});

	it("omits the Authorization header when no token is provided", async () => {
		const fetch = stubGithub({ "auditmos/audit-cli": githubRepo() });

		await fetchOssProjects({
			fetch,
			cache: stubCache(),
			repositories: ["auditmos/audit-cli"],
		});

		const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
		expect(headers.has("Authorization")).toBe(false);
	});

	const cachedProjects: OssProject[] = [
		{
			fullName: "auditmos/cached-repo",
			description: "Last known good result.",
			url: "https://github.com/auditmos/cached-repo",
			stars: 3,
			language: "Go",
			updatedAt: "2026-05-01T00:00:00Z",
		},
	];

	it.each([
		["a 5xx response", 500],
		["a rate-limited 403 response", 403],
	])("falls back to cached projects and warns on %s", async (_case, status) => {
		const fetch = stubGithub({
			"auditmos/live": githubRepo({ full_name: "auditmos/live" }),
			"auditmos/broken": status,
		});
		const cache = stubCache({
			read: vi.fn<OssProjectCache["read"]>().mockResolvedValue(cachedProjects),
		});
		const logger = { warn: vi.fn(), error: vi.fn() };

		const result = await fetchOssProjects({
			fetch,
			cache,
			logger,
			repositories: ["auditmos/live", "auditmos/broken"],
		});

		expect(result).toEqual(cachedProjects);
		expect(cache.read).toHaveBeenCalled();
		expect(logger.warn).toHaveBeenCalled();
	});

	it("falls back to cached projects on a network error", async () => {
		const fetch = vi
			.fn<OssAggregatorDependencies["fetch"]>()
			.mockRejectedValue(new TypeError("network down"));
		const cache = stubCache({
			read: vi.fn<OssProjectCache["read"]>().mockResolvedValue(cachedProjects),
		});

		const result = await fetchOssProjects({
			fetch,
			cache,
			repositories: ["auditmos/live", "auditmos/other"],
		});

		expect(result).toEqual(cachedProjects);
	});

	it("never returns a partial list when one repository fails", async () => {
		const fetch = stubGithub({
			"auditmos/live": githubRepo({ full_name: "auditmos/live" }),
			"auditmos/broken": 500,
		});
		const cache = stubCache({
			read: vi.fn<OssProjectCache["read"]>().mockResolvedValue(cachedProjects),
		});

		const result = await fetchOssProjects({
			fetch,
			cache,
			repositories: ["auditmos/live", "auditmos/broken"],
		});

		expect(result.map((project) => project.fullName)).not.toContain("auditmos/live");
	});

	it("returns an empty list when the API fails and no cache exists", async () => {
		const fetch = stubGithub({ "auditmos/broken": 500 });

		const result = await fetchOssProjects({
			fetch,
			cache: stubCache({ read: vi.fn<OssProjectCache["read"]>().mockResolvedValue(null) }),
			repositories: ["auditmos/broken"],
		});

		expect(result).toEqual([]);
	});

	it("returns an empty list when the API fails and the cache is unreadable", async () => {
		const fetch = stubGithub({ "auditmos/broken": 500 });
		const cache = stubCache({
			read: vi.fn<OssProjectCache["read"]>().mockRejectedValue(new Error("cache file missing")),
		});

		const result = await fetchOssProjects({
			fetch,
			cache,
			repositories: ["auditmos/broken"],
		});

		expect(result).toEqual([]);
	});

	it("writes the mapped projects to the cache after a successful fetch", async () => {
		const fetch = stubGithub({
			"auditmos/older": githubRepo({
				full_name: "auditmos/older",
				updated_at: "2026-01-01T00:00:00Z",
			}),
			"auditmos/newer": githubRepo({
				full_name: "auditmos/newer",
				updated_at: "2026-07-01T00:00:00Z",
			}),
		});
		const cache = stubCache();

		const result = await fetchOssProjects({
			fetch,
			cache,
			repositories: ["auditmos/older", "auditmos/newer"],
		});

		expect(cache.write).toHaveBeenCalledTimes(1);
		expect(cache.write).toHaveBeenCalledWith(result);
		expect(result.map((project) => project.fullName)).toEqual(["auditmos/newer", "auditmos/older"]);
	});

	it("does not write the cache when the API fails", async () => {
		const fetch = stubGithub({ "auditmos/broken": 500 });
		const cache = stubCache({
			read: vi.fn<OssProjectCache["read"]>().mockResolvedValue(cachedProjects),
		});

		await fetchOssProjects({ fetch, cache, repositories: ["auditmos/broken"] });

		expect(cache.write).not.toHaveBeenCalled();
	});

	it("defaults to the curated repository list when none is injected", async () => {
		const fetch = stubGithub({});

		await fetchOssProjects({ fetch, cache: stubCache() });

		expect(fetch).toHaveBeenCalledTimes(OSS_REPOSITORIES.length);
	});
});

describe("OSS_REPOSITORIES", () => {
	it("lists every repository as a distinct owner/repo path", () => {
		for (const repository of OSS_REPOSITORIES) {
			expect(repository).toMatch(/^[\w.-]+\/[\w.-]+$/);
		}

		expect(new Set<RepositoryPath>(OSS_REPOSITORIES).size).toBe(OSS_REPOSITORIES.length);
	});
});
