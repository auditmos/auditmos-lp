import type { APIRoute } from "astro";
import { llmsTxtResponse } from "@/site/md-endpoints";

export const prerender = true;

export const GET: APIRoute = async () => llmsTxtResponse();
