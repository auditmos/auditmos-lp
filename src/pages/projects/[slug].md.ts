import type { APIRoute } from "astro";
import { markdownProjectStaticPaths } from "@/site/md-endpoints";
import { markdownResponse } from "@/site/md-mirror";

export const prerender = true;

export const getStaticPaths = markdownProjectStaticPaths;

export const GET: APIRoute = ({ props }) => {
	const { markdown } = props as { markdown: string };
	return markdownResponse(markdown);
};
