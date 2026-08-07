/**
 * TDD assumptions for issue #13:
 * - The tested public interface is the OAuth module boundary:
 *   `handleOAuthRegister`, `handleOAuthToken`, `verifyAccessToken`, and the two
 *   metadata builders. The Astro page wrappers are not under test.
 * - The module is stateless by construction: the only thing that carries state
 *   between register and token is the signing key, so a client registered
 *   against one dependency object must work against a fresh one.
 * - Clock is injected, so token lifetimes are asserted rather than waited for.
 * - Not covered here: real Wrangler secrets, the deployed routes, and the
 *   authenticated rate-limit tier those tokens will unlock (issue #14).
 */

import { site } from "@/brand/site";
import {
	ACCESS_TOKEN_TTL_SECONDS,
	buildAuthorizationServerMetadata,
	buildProtectedResourceMetadata,
	createOAuthDependencies,
	handleOAuthRegister,
	handleOAuthToken,
	OAUTH_PROTECTED_RESOURCE_PATH,
	OAUTH_REGISTER_PATH,
	OAUTH_SCOPE,
	OAUTH_TOKEN_PATH,
	type OAuthDependencies,
	verifyAccessToken,
} from "./server";

const signingKey = "test-signing-key-6f2b1c9a4d";
const issuedAt = 1_700_000_000;

function deps(overrides: Partial<OAuthDependencies> = {}): OAuthDependencies {
	return { signingKey, now: () => issuedAt, ...overrides };
}

function registerRequest(body?: unknown, method = "POST"): Request {
	return new Request(`${site.url}${OAUTH_REGISTER_PATH}`, {
		method,
		headers: { "Content-Type": "application/json" },
		...(method === "POST" && body !== undefined
			? { body: typeof body === "string" ? body : JSON.stringify(body) }
			: {}),
	});
}

function tokenRequest(
	params: Record<string, string>,
	options: { headers?: Record<string, string>; method?: string } = {},
): Request {
	const method = options.method ?? "POST";

	return new Request(`${site.url}${OAUTH_TOKEN_PATH}`, {
		method,
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			...options.headers,
		},
		...(method === "POST" ? { body: new URLSearchParams(params).toString() } : {}),
	});
}

interface RegisteredClient {
	client_id: string;
	client_secret: string;
	token_endpoint: string;
	grant_types: string[];
	scope: string;
	client_secret_expires_at: number;
}

async function register(dependencies = deps()): Promise<RegisteredClient> {
	const response = await handleOAuthRegister(registerRequest({}), dependencies);
	return (await response.json()) as RegisteredClient;
}

async function tokenFor(
	client: RegisteredClient,
	dependencies = deps(),
): Promise<{ status: number; body: Record<string, unknown> }> {
	const response = await handleOAuthToken(
		tokenRequest({
			grant_type: "client_credentials",
			client_id: client.client_id,
			client_secret: client.client_secret,
		}),
		dependencies,
	);

	return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("handleOAuthRegister", () => {
	it("rejects everything but POST", async () => {
		const response = await handleOAuthRegister(registerRequest(undefined, "GET"), deps());

		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBe("POST");
	});

	it("issues a client with a secret and the endpoint that accepts it", async () => {
		const response = await handleOAuthRegister(registerRequest({}), deps());
		const client = (await response.json()) as RegisteredClient;

		expect(response.status).toBe(201);
		expect(client.client_id).not.toBe("");
		expect(client.client_secret).not.toBe("");
		expect(client.token_endpoint).toBe(`${site.url}${OAUTH_TOKEN_PATH}`);
		expect(client.grant_types).toEqual(["client_credentials"]);
		expect(client.scope).toBe(OAUTH_SCOPE);
		// RFC 7591: 0 means the secret does not expire. Nothing stores it, so
		// there is nothing that could expire it either.
		expect(client.client_secret_expires_at).toBe(0);
	});

	it("issues a secret the token endpoint accepts", async () => {
		expect((await tokenFor(await register())).status).toBe(200);
	});

	it("issues a distinct client id per registration", async () => {
		const [first, second] = [await register(), await register()];

		expect(first.client_id).not.toBe(second.client_id);
	});

	it("registers a client with no metadata at all", async () => {
		// An agent that wants nothing but a credential sends an empty body.
		const response = await handleOAuthRegister(registerRequest(undefined), deps());

		expect(response.status).toBe(201);
	});

	it("rejects a body that is not a JSON object", async () => {
		const response = await handleOAuthRegister(registerRequest("not json at all"), deps());

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_client_metadata" });
	});

	it("rejects a grant type this server does not implement", async () => {
		const response = await handleOAuthRegister(
			registerRequest({ grant_types: ["authorization_code"] }),
			deps(),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_client_metadata" });
	});

	it("verifies a credential it never stored", async () => {
		// The proof of statelessness: the dependencies that issued the client are
		// thrown away, and a fresh object holding only the same key still accepts
		// it. Nothing was written anywhere, so nothing has to be read back.
		const client = await register(deps());
		const { status } = await tokenFor(client, deps());

		expect(status).toBe(200);
	});

	it("rejects a credential issued under a different signing key", async () => {
		const client = await register(deps({ signingKey: "some-other-key" }));
		const { status, body } = await tokenFor(client, deps());

		expect(status).toBe(401);
		expect(body).toMatchObject({ error: "invalid_client" });
	});
});

describe("handleOAuthToken", () => {
	it("rejects everything but POST", async () => {
		const response = await handleOAuthToken(tokenRequest({}, { method: "GET" }), deps());

		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBe("POST");
	});

	it("issues a bearer token with an explicit lifetime", async () => {
		const { status, body } = await tokenFor(await register());

		expect(status).toBe(200);
		expect(body).toMatchObject({
			token_type: "Bearer",
			expires_in: ACCESS_TOKEN_TTL_SECONDS,
			scope: OAUTH_SCOPE,
		});
		expect(typeof body.access_token).toBe("string");
	});

	it("tells caches not to keep the token", async () => {
		const client = await register();
		const response = await handleOAuthToken(
			tokenRequest({
				grant_type: "client_credentials",
				client_id: client.client_id,
				client_secret: client.client_secret,
			}),
			deps(),
		);

		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});

	it("accepts client_secret_basic as well as credentials in the body", async () => {
		const client = await register();
		const credentials = btoa(`${client.client_id}:${client.client_secret}`);
		const response = await handleOAuthToken(
			tokenRequest(
				{ grant_type: "client_credentials" },
				{ headers: { Authorization: `Basic ${credentials}` } },
			),
			deps(),
		);

		expect(response.status).toBe(200);
	});

	it("rejects a wrong secret as invalid_client", async () => {
		const client = await register();
		const response = await handleOAuthToken(
			tokenRequest({
				grant_type: "client_credentials",
				client_id: client.client_id,
				client_secret: "wrong-secret",
			}),
			deps(),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ error: "invalid_client" });
	});

	it("rejects an unknown client id as invalid_client", async () => {
		const response = await handleOAuthToken(
			tokenRequest({
				grant_type: "client_credentials",
				client_id: "never-registered",
				client_secret: "made-up",
			}),
			deps(),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ error: "invalid_client" });
	});

	it.each([
		"authorization_code",
		"refresh_token",
		"password",
	])("rejects the %s grant as unsupported_grant_type", async (grantType) => {
		const client = await register();
		const response = await handleOAuthToken(
			tokenRequest({
				grant_type: grantType,
				client_id: client.client_id,
				client_secret: client.client_secret,
			}),
			deps(),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "unsupported_grant_type" });
	});

	it("rejects a body with no grant type as invalid_request", async () => {
		const response = await handleOAuthToken(tokenRequest({}), deps());

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_request" });
	});
});

describe("verifyAccessToken", () => {
	it("accepts a freshly issued token and reports who it was issued to", async () => {
		const client = await register();
		const { body } = await tokenFor(client);
		const result = await verifyAccessToken(String(body.access_token), deps());

		expect(result).toEqual({
			valid: true,
			claims: {
				iss: site.url,
				sub: client.client_id,
				aud: `${site.url}/mcp`,
				scope: OAUTH_SCOPE,
				iat: issuedAt,
				exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS,
			},
		});
	});

	it("rejects the token one second after it expires", async () => {
		const { body } = await tokenFor(await register());
		const later = deps({ now: () => issuedAt + ACCESS_TOKEN_TTL_SECONDS + 1 });

		expect(await verifyAccessToken(String(body.access_token), later)).toEqual({
			valid: false,
			reason: "expired",
		});
	});

	it("still accepts the token on its last valid second", async () => {
		const { body } = await tokenFor(await register());
		const atExpiry = deps({ now: () => issuedAt + ACCESS_TOKEN_TTL_SECONDS });

		expect(await verifyAccessToken(String(body.access_token), atExpiry)).toMatchObject({
			valid: true,
		});
	});

	it("rejects a token signed with another key", async () => {
		const foreign = deps({ signingKey: "another-key" });
		const { body } = await tokenFor(await register(foreign), foreign);

		expect(await verifyAccessToken(String(body.access_token), deps())).toEqual({
			valid: false,
			reason: "signature",
		});
	});

	it.each([
		"",
		"garbage",
		"a.b",
		"a.b.c",
		"not.a.jwt.at.all",
	])("rejects %j as malformed rather than throwing", async (token) => {
		expect(await verifyAccessToken(token, deps())).toMatchObject({ valid: false });
	});

	it("rejects a token whose payload was edited after signing", async () => {
		const { body } = await tokenFor(await register());
		const [header, payload, signature] = String(body.access_token).split(".");
		const tampered = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/"))) as Record<
			string,
			unknown
		>;
		tampered.scope = "write:everything";
		const forged = `${header}.${btoa(JSON.stringify(tampered))
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replaceAll("=", "")}.${signature}`;

		expect(await verifyAccessToken(forged, deps())).toEqual({ valid: false, reason: "signature" });
	});
});

describe("createOAuthDependencies", () => {
	it("reads the signing key from the environment and clocks in seconds", () => {
		const dependencies = createOAuthDependencies({ OAUTH_SIGNING_KEY: "from-env" });

		expect(dependencies.signingKey).toBe("from-env");
		expect(Number.isInteger(dependencies.now())).toBe(true);
		expect(dependencies.now()).toBeGreaterThan(1_700_000_000);
	});
});

describe("deployment identity", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("names the host it is actually deployed on, not the production one", async () => {
		// Every other URL on this site is canonical-production on purpose. These
		// are not marketing links: `resource` identifies the endpoint a token is
		// good for, and on staging that endpoint is staging's. Naming production
		// would issue staging credentials whose audience is a host that would
		// reject them — and the readiness scanner rejects the mismatch outright.
		vi.stubEnv("CLOUDFLARE_ENV", "staging");

		expect(buildProtectedResourceMetadata()).toMatchObject({
			resource: "https://staging.auditmos.com/mcp",
			authorization_servers: ["https://staging.auditmos.com"],
		});
		expect(buildAuthorizationServerMetadata()).toMatchObject({
			issuer: "https://staging.auditmos.com",
			token_endpoint: `https://staging.auditmos.com${OAUTH_TOKEN_PATH}`,
		});

		const client = await register();
		expect(client.token_endpoint).toBe(`https://staging.auditmos.com${OAUTH_TOKEN_PATH}`);

		const { body } = await tokenFor(client);
		const claims = await verifyAccessToken(String(body.access_token), deps());
		expect(claims).toMatchObject({
			valid: true,
			claims: {
				iss: "https://staging.auditmos.com",
				aud: "https://staging.auditmos.com/mcp",
			},
		});
	});

	it("falls back to the production host for any other environment", () => {
		vi.stubEnv("CLOUDFLARE_ENV", "dev");

		expect(buildAuthorizationServerMetadata()).toMatchObject({ issuer: site.url });
	});
});

describe("buildAuthorizationServerMetadata", () => {
	it("is an RFC 8414 document naming only the grant this server implements", () => {
		expect(buildAuthorizationServerMetadata()).toEqual({
			issuer: site.url,
			token_endpoint: `${site.url}${OAUTH_TOKEN_PATH}`,
			registration_endpoint: `${site.url}${OAUTH_REGISTER_PATH}`,
			grant_types_supported: ["client_credentials"],
			// No grant here uses a redirect, so there is no response type to
			// support and no authorization endpoint to advertise.
			response_types_supported: [],
			token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
			scopes_supported: [OAUTH_SCOPE],
			service_documentation: `${site.url}/auth.md`,
		});
	});
});

describe("buildProtectedResourceMetadata", () => {
	it("lives at the path RFC 9728 derives from the resource it describes", () => {
		// RFC 9728 §3.1 forms the metadata URL by inserting the well-known
		// segment between the host and the *path* of the resource identifier.
		// The resource is `<site>/mcp`, so the document belongs at
		// `/.well-known/oauth-protected-resource/mcp` — serving it at the bare
		// well-known path would only be right if the whole site were the
		// resource, and a client deriving the URL correctly would 404.
		expect(OAUTH_PROTECTED_RESOURCE_PATH).toBe("/.well-known/oauth-protected-resource/mcp");
	});

	it("is an RFC 9728 document naming /mcp as the resource this site protects", () => {
		expect(buildProtectedResourceMetadata()).toEqual({
			resource: `${site.url}/mcp`,
			resource_name: "Auditmos MCP server",
			authorization_servers: [site.url],
			scopes_supported: [OAUTH_SCOPE],
			bearer_methods_supported: ["header"],
			resource_documentation: `${site.url}/auth.md`,
		});
	});
});
