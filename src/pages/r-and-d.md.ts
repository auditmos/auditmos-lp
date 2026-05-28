import type { APIRoute } from "astro";
import { markdownPageResponse } from "@/site/md-endpoints";

export const prerender = true;

export const GET: APIRoute = async () => markdownPageResponse("/r-and-d");
