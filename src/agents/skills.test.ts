/**
 * TDD assumptions for issue #16:
 * - The tested interface is `agentSkills`, `renderSkillMarkdown(skill)`, and
 *   `buildSkillsIndex(digests)`.
 * - Digests are an input, not a computed field: they are sha256 of the bytes
 *   actually served, which only the build knows. Passing them in is what lets
 *   `src/site/build-output.test.ts` recompute them from the emitted files and
 *   fail when a skill was edited and its digest was not.
 * - Content correctness is asserted as "does not overclaim": every capability a
 *   skill describes has to exist somewhere else in this repo.
 */

import { MCP_ENDPOINT_PATH, MCP_RATE_LIMIT, MCP_RATE_LIMIT_AUTH } from "@/mcp/server";
import { OAUTH_REGISTER_PATH, OAUTH_TOKEN_PATH } from "@/oauth/server";
import {
	AGENT_SKILLS_INDEX_PATH,
	agentSkills,
	buildSkillsIndex,
	renderSkillMarkdown,
	skillMarkdownPath,
} from "./skills";

interface SkillsIndex {
	$schema: string;
	skills: {
		name: string;
		type: string;
		description: string;
		url: string;
		digest: string;
	}[];
}

const digests = Object.fromEntries(
	agentSkills.map((skill) => [skill.name, `sha256:${skill.name}`]),
);
const index = buildSkillsIndex(digests) as SkillsIndex;

describe("agentSkills", () => {
	it("is served from the discovery path the schema reserves", () => {
		expect(AGENT_SKILLS_INDEX_PATH).toBe("/.well-known/agent-skills/index.json");
	});

	it("ships the three launch skills", () => {
		expect(agentSkills.map((skill) => skill.name)).toEqual([
			"company-info",
			"services",
			"read-this-site",
		]);
	});

	it("gives each skill its own directory, per the discovery layout", () => {
		for (const skill of agentSkills) {
			expect(skillMarkdownPath(skill)).toBe(`/.well-known/agent-skills/${skill.name}/SKILL.md`);
		}
	});
});

describe("renderSkillMarkdown", () => {
	it.each(agentSkills)("opens $name with frontmatter naming it", (skill) => {
		const markdown = renderSkillMarkdown(skill);

		expect(markdown.startsWith("---\n")).toBe(true);
		expect(markdown).toContain(`name: ${skill.name}`);
		expect(markdown).toContain(`description: ${skill.description}`);
	});

	it.each(agentSkills)("gives $name a body, not just frontmatter", (skill) => {
		const [, body] = renderSkillMarkdown(skill).split(/^---$/m).slice(1);

		expect(body.trim().length).toBeGreaterThan(200);
		expect(body).toContain("# ");
	});

	it("grounds company-info in facts the site publishes", () => {
		const markdown = renderSkillMarkdown(agentSkills[0]);

		expect(markdown).toContain("Auditmos OÜ");
		expect(markdown).toContain("17025406");
		expect(markdown).toContain("EE102758111");
		expect(markdown).toContain("Tallinn");
	});

	it("names all three service lines in services", () => {
		const markdown = renderSkillMarkdown(agentSkills[1]);

		expect(markdown).toContain("Software development");
		expect(markdown).toContain("Security audits");
		expect(markdown).toContain("R&D services");
	});

	it("walks every surface that exists, including both rate-limit tiers", () => {
		const markdown = renderSkillMarkdown(agentSkills[2]);

		// This is the skill that teaches an agent to use the site. If it omits
		// registration, every reader stays on the anonymous tier forever without
		// knowing a better one exists.
		for (const surface of [
			"/llms.txt",
			MCP_ENDPOINT_PATH,
			OAUTH_REGISTER_PATH,
			OAUTH_TOKEN_PATH,
			"/auth.md",
			".md",
		]) {
			expect(markdown).toContain(surface);
		}

		expect(markdown).toContain(`${MCP_RATE_LIMIT.requests} requests`);
		expect(markdown).toContain(`${MCP_RATE_LIMIT_AUTH.requests} requests`);
	});
});

describe("buildSkillsIndex", () => {
	it("declares the discovery schema it conforms to", () => {
		// Without `$schema` the readiness scanner falls back to reading the index
		// as v0.1.0 — the document parsed either way, and quietly meant something
		// older than it is.
		expect(index.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json");
	});

	it("lists every registered skill, with the path that serves it", () => {
		expect(index.skills.map((skill) => skill.name)).toEqual(agentSkills.map((skill) => skill.name));

		for (const [position, entry] of index.skills.entries()) {
			// Site-relative, as the reference implementation publishes them: an
			// absolute production URL would send a staging reader to production's
			// copy of a file that may not match staging's digests.
			expect(entry.url).toBe(skillMarkdownPath(agentSkills[position]));
			expect(entry.description).toBe(agentSkills[position].description);
			expect(entry.type).toBe("skill-md");
		}
	});

	it("carries the digest it was handed for each skill", () => {
		// The index never computes its own digest: it is told what the build
		// actually emitted, so a mismatch is a build failure rather than a
		// document that confidently attests to bytes nobody served.
		for (const entry of index.skills) {
			expect(entry.digest).toBe(`sha256:${entry.name}`);
		}
	});

	it("refuses to publish a skill it has no digest for", () => {
		expect(() => buildSkillsIndex({})).toThrow(/digest/i);
	});
});
