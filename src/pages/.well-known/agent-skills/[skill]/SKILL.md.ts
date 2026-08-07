import type { APIRoute } from "astro";
import { type AgentSkill, agentSkills, renderSkillMarkdown } from "@/agents/skills";

export const prerender = true;

/**
 * One `SKILL.md` per registered skill, at the directory layout the discovery
 * schema expects. Generated from the same registry the index is built from, so
 * a skill can never appear in one and not the other.
 */
export function getStaticPaths() {
	return agentSkills.map((skill) => ({
		params: { skill: skill.name },
		props: { skill },
	}));
}

export const GET: APIRoute<{ skill: AgentSkill }> = ({ props }) =>
	new Response(renderSkillMarkdown(props.skill), {
		status: 200,
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
		},
	});
