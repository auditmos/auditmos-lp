import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { createOAuthDependencies, handleOAuthRegister } from "@/oauth/server";

export const prerender = false;

/**
 * RFC 7591 dynamic client registration. One of two request-time OAuth routes —
 * issuing a credential is a cryptographic exchange over a POST body, which a
 * prerendered asset cannot perform.
 *
 * Open and unauthenticated on purpose: the credential unlocks a higher rate
 * limit on public data, not access to anything private, so a registration gate
 * would cost an agent a round trip and buy this site nothing.
 */
const registerRoute: APIRoute = ({ request }) =>
	handleOAuthRegister(request, createOAuthDependencies(env));

export const GET = registerRoute;
export const POST = registerRoute;
