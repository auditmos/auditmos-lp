import { OSS_REPOSITORIES, type RepositoryPath } from "./repositories";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface OssProject {
	fullName: string;
	description: string;
	url: string;
	stars: number;
	language: string | null;
	updatedAt: string;
}

export interface OssProjectCache {
	read: () => Promise<OssProject[] | null>;
	write: (projects: readonly OssProject[]) => Promise<void>;
}

export interface OssAggregatorDependencies {
	fetch: FetchLike;
	cache: OssProjectCache;
	token?: string;
	repositories?: readonly RepositoryPath[];
	logger?: Pick<Console, "warn" | "error">;
}

interface GithubRepo {
	full_name: string;
	description: string | null;
	html_url: string;
	stargazers_count: number;
	language: string | null;
	updated_at: string;
}

/**
 * A listed repository that GitHub will not serve publicly — deleted, renamed, or turned
 * private. Excluded from the result rather than failing the run: the site must not claim a
 * repository that a visitor cannot open.
 */
const UNAVAILABLE = Symbol("unavailable");

class OssFetchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OssFetchError";
	}
}

function errorReason(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function toOssProject(repo: GithubRepo): OssProject {
	return {
		fullName: repo.full_name,
		description: repo.description ?? "",
		url: repo.html_url,
		stars: repo.stargazers_count,
		language: repo.language,
		updatedAt: repo.updated_at,
	};
}

// ISO 8601 UTC strings sort lexicographically in chronological order.
function compareOssProject(a: OssProject, b: OssProject): number {
	const dateCompare = b.updatedAt.localeCompare(a.updatedAt);
	if (dateCompare !== 0) return dateCompare;

	const starCompare = b.stars - a.stars;
	if (starCompare !== 0) return starCompare;

	return a.fullName.localeCompare(b.fullName);
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

async function fetchRepo(
	deps: OssAggregatorDependencies,
	headers: HeadersInit,
	repository: RepositoryPath,
): Promise<GithubRepo | typeof UNAVAILABLE> {
	const response = await deps.fetch(`https://api.github.com/repos/${repository}`, { headers });

	// 404 also covers a private repo read without a token — not public, so not countable.
	if (response.status === 404) return UNAVAILABLE;

	if (!response.ok) {
		throw new OssFetchError(`GitHub responded with ${response.status} for ${repository}`);
	}

	return (await response.json()) as GithubRepo;
}

/**
 * Resolves the curated repository list to displayable records.
 *
 * All-or-nothing by design: if any repository fails for a reason other than being
 * unavailable (rate limit, 5xx, network), the whole run falls back to the last committed
 * cache. A partial result would silently undercount and put a wrong number on the homepage,
 * which is the exact failure this list exists to prevent.
 */
export async function fetchOssProjects(deps: OssAggregatorDependencies): Promise<OssProject[]> {
	const repositories = deps.repositories ?? OSS_REPOSITORIES;

	try {
		const headers = buildHeaders(deps.token);
		// allSettled, not all: a rejection from Promise.all would leave the remaining
		// in-flight requests to reject unobserved.
		const settled = await Promise.allSettled(
			repositories.map((repository) => fetchRepo(deps, headers, repository)),
		);

		const projects: OssProject[] = [];
		for (const [index, outcome] of settled.entries()) {
			if (outcome.status === "rejected") throw outcome.reason;

			if (outcome.value === UNAVAILABLE) {
				deps.logger?.warn("oss_repository_unavailable", { repository: repositories[index] });
				continue;
			}

			projects.push(toOssProject(outcome.value));
		}

		projects.sort(compareOssProject);

		await writeCacheSafely(projects, deps);
		return projects;
	} catch (error) {
		deps.logger?.warn("oss_aggregator_fallback", { reason: errorReason(error) });

		const cached = await readCacheSafely(deps);
		return cached ?? [];
	}
}

async function readCacheSafely(deps: OssAggregatorDependencies): Promise<OssProject[] | null> {
	try {
		return await deps.cache.read();
	} catch (error) {
		deps.logger?.error("oss_cache_read_failed", { reason: errorReason(error) });
		return null;
	}
}

// A cache-write failure must never discard freshly fetched data or fail the build.
async function writeCacheSafely(
	projects: readonly OssProject[],
	deps: OssAggregatorDependencies,
): Promise<void> {
	try {
		await deps.cache.write(projects);
	} catch (error) {
		deps.logger?.error("oss_cache_write_failed", { reason: errorReason(error) });
	}
}
