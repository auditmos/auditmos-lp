/**
 * The explicit open-source inventory: every repository counted on the homepage proof strip
 * and listed on `/open-source`.
 *
 * This list is the single source of truth for the open-source count. Membership is curated
 * here by hand — nothing is enumerated from a GitHub organization — so repositories from any
 * owner can be included, and unrelated back-catalogue work is never swept in. Only the
 * metadata (description, stars, language, last update) is read from GitHub at build time.
 *
 * To change what the site claims, edit this list. The homepage number, the `/open-source`
 * cards, and the `llms.txt` markdown mirror all derive from it, so they cannot disagree.
 */

/** A GitHub repository reference in `owner/repo` form. */
export type RepositoryPath = `${string}/${string}`;

export const OSS_REPOSITORIES = [
	"auditmos/signmos",
	"tkowalczyk/wizytowka-link",
	"auditmos/saas-on-cf",
	"auditmos/skills",
	"auditmos/astro-on-cf",
	"auditmos/hono-on-cf",
	"auditmos/tstack-on-cf-onchain",
	"auditmos/brainstormer",
	"auditmos/landingos",
	"auditmos/ogsfrompoly-lp",
	"auditmos/auditmos-lp",
] as const satisfies readonly RepositoryPath[];
