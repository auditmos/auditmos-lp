/**
 * OAuth 2.0 for agents — the smallest thing that is still real.
 *
 * Two request-time endpoints (`/oauth/register`, `/oauth/token`) and the three
 * prerendered metadata documents that describe them. The interface is those
 * handlers plus `verifyAccessToken`, which `/mcp` uses to decide which
 * rate-limit tier a caller gets; everything else — HMAC derivation, JWT
 * assembly, RFC error shapes — is internal.
 *
 * What this deliberately is not: there is no `authorization_code` grant, no
 * user accounts, no consent screen, and no client database. Registration is
 * open and unauthenticated because the credential does not grant access to
 * anything private — every byte this site serves is public. A token buys a
 * higher rate limit, nothing more, so the honest amount of machinery is a
 * signing key and two round trips.
 *
 * Statelessness is a property, not an optimisation: `client_secret` is derived
 * from the `client_id` by HMAC, so verification recomputes instead of looking
 * up. Nothing here writes to KV, D1, a Durable Object, or a cache, which is why
 * an agent can register and call the API within one second of arriving.
 */

import { z } from "astro/zod";
import { site } from "@/brand/site";
import { MCP_ENDPOINT_PATH } from "@/mcp/server";
import {
	clientSecretMatches,
	deriveClientSecret,
	readSignedAccessToken,
	signAccessToken,
} from "./crypto";

export const OAUTH_REGISTER_PATH = "/oauth/register";
export const OAUTH_TOKEN_PATH = "/oauth/token";

/**
 * RFC 8414 metadata, served byte-identically at both paths: `.well-known`
 * placement differs between the OAuth and OpenID conventions and clients probe
 * one or the other, so serving one document at two URLs costs nothing and
 * removes a guess. The scanner probes the openid path first.
 */
export const OAUTH_AUTHORIZATION_SERVER_PATHS = [
	"/.well-known/openid-configuration",
	"/.well-known/oauth-authorization-server",
] as const;

/**
 * RFC 9728 protected-resource metadata: what `/mcp` expects and who issues it.
 *
 * The path is derived, not chosen. §3.1 forms a resource's metadata URL by
 * inserting `/.well-known/oauth-protected-resource` between the host and the
 * *path* of the resource identifier — so a resource of `<site>/mcp` publishes
 * at `/.well-known/oauth-protected-resource/mcp`. The bare well-known path
 * would be correct only if the whole site were the protected resource, and a
 * client that derives the URL by the book would find nothing there.
 */
export const OAUTH_PROTECTED_RESOURCE_PATH = `/.well-known/oauth-protected-resource${MCP_ENDPOINT_PATH}`;

/** The only scope. It buys rate limit, not access — everything here is public. */
export const OAUTH_SCOPE = "read:site";

export const ACCESS_TOKEN_TTL_SECONDS = 3600;

const SUPPORTED_GRANT_TYPE = "client_credentials";

/**
 * Origins this site is deployed on, by `CLOUDFLARE_ENV`. Everything else on
 * the site names the production URL on purpose — canonical tags, the sitemap,
 * every marketing link — but these documents are not links to content. A
 * `resource` identifies the endpoint a token is good for, and an `iss` names
 * who issued it; on staging both are staging's. Naming production there would
 * mint credentials whose audience is a host that would reject them, since the
 * signing keys are deliberately different per environment.
 *
 * `staging` is the only entry because it is the only non-production deployment
 * with a stable hostname (`wrangler.jsonc` gives the dev Worker no route);
 * anything else falls back to production. `wrangler-config.test.ts` asserts
 * this host still matches the staging route.
 */
const DEPLOY_ORIGINS: Readonly<Record<string, string>> = {
	staging: "https://staging.auditmos.com",
};

/**
 * Read per call, not once at module load: the value is baked into prerendered
 * documents at build time (the deploy script sets `CLOUDFLARE_ENV` for the
 * build) and read from the Worker's own vars at request time, so both halves
 * of a deployment agree without threading a config object through everything.
 */
function deployedOrigin(): string {
	const environment = typeof process === "undefined" ? undefined : process.env?.CLOUDFLARE_ENV;

	return (environment ? DEPLOY_ORIGINS[environment] : undefined) ?? site.url;
}

/** The narrative twin of these documents, in prose, on the same deployment. */
function authDocumentationUrl(): string {
	return `${deployedOrigin()}/auth.md`;
}

function tokenAudience(): string {
	return `${deployedOrigin()}${MCP_ENDPOINT_PATH}`;
}

export interface OAuthDependencies {
	signingKey: string;
	/** Seconds since the epoch. Injected so token lifetimes are testable. */
	now: () => number;
}

export function createOAuthDependencies(env: { OAUTH_SIGNING_KEY: string }): OAuthDependencies {
	return {
		signingKey: env.OAUTH_SIGNING_KEY,
		now: () => Math.floor(Date.now() / 1000),
	};
}

/** RFC 6749 §5.2 / RFC 7591 §3.2.2 error body: a code plus prose for the human reading logs. */
function oauthError(error: string, description: string, status: number): Response {
	return Response.json(
		{ error, error_description: description },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}

function methodNotAllowed(): Response {
	return Response.json(
		{
			error: "invalid_request",
			error_description: "POST is the only method this endpoint accepts.",
		},
		{ status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
	);
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | undefined> {
	const body = (await request.text()).trim();
	// An agent that wants nothing but a credential sends no metadata at all.
	if (body === "") return {};

	try {
		const parsed: unknown = JSON.parse(body);
		return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
}

// RFC 7591 client metadata, narrowed to what this server can honour. Unknown
// members are ignored rather than rejected: the RFC lets a server do that, and
// an agent sending a full metadata document should not be refused over a field
// that has no meaning where there are no redirects and no user consent.
const clientMetadataSchema = z.object({
	client_name: z.string().optional(),
	grant_types: z.array(z.string()).optional(),
	scope: z.string().optional(),
});

export async function handleOAuthRegister(
	request: Request,
	deps: OAuthDependencies,
): Promise<Response> {
	if (request.method !== "POST") return methodNotAllowed();

	const body = await readJsonObject(request);
	if (!body) {
		return oauthError(
			"invalid_client_metadata",
			"The request body must be a JSON object of RFC 7591 client metadata.",
			400,
		);
	}

	const parsed = clientMetadataSchema.safeParse(body);
	if (!parsed.success) {
		return oauthError(
			"invalid_client_metadata",
			parsed.error.issues[0]?.message ?? "Unusable client metadata.",
			400,
		);
	}

	// Refusing here rather than silently issuing a credential that cannot do
	// what was asked for: a client that wants `authorization_code` should learn
	// that now, not at the token endpoint.
	const requestedGrants = parsed.data.grant_types ?? [SUPPORTED_GRANT_TYPE];
	if (requestedGrants.some((grant) => grant !== SUPPORTED_GRANT_TYPE)) {
		return oauthError(
			"invalid_client_metadata",
			`This server implements the ${SUPPORTED_GRANT_TYPE} grant only.`,
			400,
		);
	}

	const clientId = crypto.randomUUID();

	return Response.json(
		{
			client_id: clientId,
			client_secret: await deriveClientSecret(clientId, deps.signingKey),
			client_id_issued_at: deps.now(),
			// 0 means "does not expire" (RFC 7591 §3.2.1). Nothing stores the
			// secret, so nothing could expire it.
			client_secret_expires_at: 0,
			grant_types: [SUPPORTED_GRANT_TYPE],
			token_endpoint_auth_method: "client_secret_basic",
			scope: OAUTH_SCOPE,
			// Not an RFC 7591 response field, but the one thing a freshly
			// registered client needs next, and extra members are allowed.
			token_endpoint: `${deployedOrigin()}${OAUTH_TOKEN_PATH}`,
			registration_client_name: parsed.data.client_name,
		},
		{ status: 201, headers: { "Cache-Control": "no-store" } },
	);
}

const tokenRequestSchema = z.object({
	grant_type: z.string().min(1),
	client_id: z.string().optional(),
	client_secret: z.string().optional(),
	scope: z.string().optional(),
});

/** RFC 6749 §2.3.1 `client_secret_basic`: base64 of `client_id:client_secret`. */
function basicCredentials(request: Request): { id: string; secret: string } | undefined {
	const header = request.headers.get("authorization") ?? "";
	if (!header.toLowerCase().startsWith("basic ")) return undefined;

	try {
		const decoded = atob(header.slice("basic ".length).trim());
		const separator = decoded.indexOf(":");
		if (separator === -1) return undefined;

		return {
			id: decodeURIComponent(decoded.slice(0, separator)),
			secret: decodeURIComponent(decoded.slice(separator + 1)),
		};
	} catch {
		return undefined;
	}
}

async function readFormBody(request: Request): Promise<Record<string, string>> {
	const body = await request.text();

	return Object.fromEntries(new URLSearchParams(body));
}

export async function handleOAuthToken(
	request: Request,
	deps: OAuthDependencies,
): Promise<Response> {
	if (request.method !== "POST") return methodNotAllowed();

	const parsed = tokenRequestSchema.safeParse(await readFormBody(request));
	if (!parsed.success) {
		return oauthError(
			"invalid_request",
			"Send an application/x-www-form-urlencoded body with a grant_type.",
			400,
		);
	}

	if (parsed.data.grant_type !== SUPPORTED_GRANT_TYPE) {
		return oauthError(
			"unsupported_grant_type",
			`This server implements the ${SUPPORTED_GRANT_TYPE} grant only.`,
			400,
		);
	}

	const basic = basicCredentials(request);
	const clientId = basic?.id ?? parsed.data.client_id ?? "";
	const clientSecret = basic?.secret ?? parsed.data.client_secret ?? "";

	// One answer for an unknown client and a wrong secret: telling them apart
	// would turn this endpoint into an oracle for which client ids exist.
	if (!clientId || !(await clientSecretMatches(clientId, clientSecret, deps.signingKey))) {
		return oauthError("invalid_client", "Client authentication failed.", 401);
	}

	const issuedAt = deps.now();
	const accessToken = await signAccessToken(
		{
			iss: deployedOrigin(),
			sub: clientId,
			aud: tokenAudience(),
			scope: OAUTH_SCOPE,
			iat: issuedAt,
			exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS,
		},
		deps.signingKey,
	);

	return Response.json(
		{
			access_token: accessToken,
			token_type: "Bearer",
			expires_in: ACCESS_TOKEN_TTL_SECONDS,
			scope: OAUTH_SCOPE,
		},
		{ status: 200, headers: { "Cache-Control": "no-store" } },
	);
}

export type AccessTokenVerification =
	| {
			valid: true;
			claims: { iss: string; sub: string; aud: string; scope: string; iat: number; exp: number };
	  }
	| { valid: false; reason: "signature" | "expired" };

/**
 * Pure verification: no network, no storage, no clock of its own. `/mcp` calls
 * this on every request, so it has to cost nothing but one HMAC.
 */
export async function verifyAccessToken(
	token: string,
	deps: OAuthDependencies,
): Promise<AccessTokenVerification> {
	const claims = await readSignedAccessToken(token, deps.signingKey);
	if (!claims) return { valid: false, reason: "signature" };

	// Valid through its final second: `exp` is the last instant the token is
	// good for, not the first instant it is not.
	if (deps.now() > claims.exp) return { valid: false, reason: "expired" };

	return { valid: true, claims };
}

export function buildAuthorizationServerMetadata(): unknown {
	return {
		issuer: deployedOrigin(),
		token_endpoint: `${deployedOrigin()}${OAUTH_TOKEN_PATH}`,
		registration_endpoint: `${deployedOrigin()}${OAUTH_REGISTER_PATH}`,
		grant_types_supported: [SUPPORTED_GRANT_TYPE],
		// No grant here redirects a user agent, so there is no response type to
		// support and no authorization endpoint to advertise. An empty list is
		// the honest answer; omitting the member would be a claim of unknown.
		response_types_supported: [],
		token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
		scopes_supported: [OAUTH_SCOPE],
		service_documentation: authDocumentationUrl(),
	};
}

export function buildProtectedResourceMetadata(): unknown {
	return {
		resource: tokenAudience(),
		resource_name: "Auditmos MCP server",
		authorization_servers: [deployedOrigin()],
		scopes_supported: [OAUTH_SCOPE],
		bearer_methods_supported: ["header"],
		resource_documentation: authDocumentationUrl(),
	};
}
