type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface OssProject {
	name: string;
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
	org?: string;
	logger?: Pick<Console, "warn" | "error">;
	includeArchived?: boolean;
	includeForks?: boolean;
}

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

const DEFAULT_ORG = "auditmos";
const PER_PAGE = 100;
const MAX_PAGES = 10;

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
		name: repo.name,
		description: repo.description ?? "",
		url: repo.html_url,
		stars: repo.stargazers_count,
		language: repo.language,
		updatedAt: repo.updated_at,
	};
}

function keepRepo(repo: GithubRepo, includeArchived: boolean, includeForks: boolean): boolean {
	if (repo.archived && !includeArchived) return false;
	if (repo.fork && !includeForks) return false;
	return true;
}

// ISO 8601 UTC strings sort lexicographically in chronological order.
function compareOssProject(a: OssProject, b: OssProject): number {
	const dateCompare = b.updatedAt.localeCompare(a.updatedAt);
	if (dateCompare !== 0) return dateCompare;

	const starCompare = b.stars - a.stars;
	if (starCompare !== 0) return starCompare;

	return a.name.localeCompare(b.name);
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

async function fetchAllRepos(deps: OssAggregatorDependencies, org: string): Promise<GithubRepo[]> {
	const headers = buildHeaders(deps.token);
	const repos: GithubRepo[] = [];

	for (let page = 1; page <= MAX_PAGES; page++) {
		const response = await deps.fetch(
			`https://api.github.com/orgs/${org}/repos?per_page=${PER_PAGE}&page=${page}`,
			{ headers },
		);

		// A 404 means the org exposes no listable repos — an empty result, not a failure.
		if (response.status === 404) break;

		if (!response.ok) {
			throw new OssFetchError(`GitHub responded with ${response.status}`);
		}

		const batch = (await response.json()) as GithubRepo[];
		repos.push(...batch);

		if (batch.length < PER_PAGE) break;
	}

	return repos;
}

export async function fetchOssProjects(deps: OssAggregatorDependencies): Promise<OssProject[]> {
	const org = deps.org ?? DEFAULT_ORG;
	const includeArchived = deps.includeArchived ?? false;
	const includeForks = deps.includeForks ?? false;

	try {
		const repos = await fetchAllRepos(deps, org);
		const projects = repos
			.filter((repo) => keepRepo(repo, includeArchived, includeForks))
			.map(toOssProject)
			.sort(compareOssProject);

		await writeCacheSafely(projects, deps);
		return projects;
	} catch (error) {
		deps.logger?.warn("oss_aggregator_fallback", { org, reason: errorReason(error) });

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
