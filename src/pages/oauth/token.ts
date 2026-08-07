import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { createOAuthDependencies, handleOAuthToken } from "@/oauth/server";

export const prerender = false;

/**
 * RFC 6749 token endpoint, `client_credentials` grant only. The second and last
 * request-time OAuth route.
 *
 * GET is wired to the same handler so it answers 405 with `Allow: POST` rather
 * than Astro's 404 — a client that guessed the method should be told which one
 * to use.
 */
const tokenRoute: APIRoute = ({ request }) =>
	handleOAuthToken(request, createOAuthDependencies(env));

export const GET = tokenRoute;
export const POST = tokenRoute;
