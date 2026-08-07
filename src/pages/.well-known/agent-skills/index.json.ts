import { buildSkillsIndex, skillDigests } from "@/agents/skills";

export const prerender = true;

/**
 * The agent-skills discovery index.
 *
 * Digests are computed here, at build time, from the same string the SKILL.md
 * endpoints return — and `src/site/build-output.test.ts` recomputes them from
 * the files that actually landed in `dist`. A skill edited without its digest
 * following therefore fails the build, rather than shipping an index that
 * confidently attests to bytes nobody serves.
 */
export async function GET(): Promise<Response> {
	const index = buildSkillsIndex(await skillDigests());

	return new Response(`${JSON.stringify(index, null, 2)}\n`, {
		status: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
