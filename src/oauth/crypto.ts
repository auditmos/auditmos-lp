/**
 * The HMAC primitives behind the stateless OAuth module.
 *
 * Internal to `src/oauth/` — nothing outside it imports this file. Two things
 * live here, both derived from the same `OAUTH_SIGNING_KEY`:
 *
 * 1. **Client secrets.** `client_secret = HMAC(key, "client:" + client_id)`, so
 *    verification recomputes rather than looks up. That is what lets dynamic
 *    registration touch no storage at all: there is no client table because
 *    there is nothing worth writing to one.
 * 2. **Access tokens.** Compact `HS256` JWTs. Same reasoning — a token is
 *    verified by recomputing its signature, so `/mcp` needs no round trip to
 *    anything to decide whether a bearer token is real.
 *
 * Both verifications go through `crypto.subtle.verify`, which compares in
 * constant time; a hand-rolled string comparison would leak the secret one byte
 * at a time. WebCrypto is available in workerd and in Node, so this runs
 * unchanged in the Worker and under Vitest.
 */

const encoder = new TextEncoder();

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let binary = "";
	for (const byte of view) binary += String.fromCharCode(byte);

	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string): Uint8Array | undefined {
	try {
		const padded = value.replaceAll("-", "+").replaceAll("_", "/");
		const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));

		return Uint8Array.from(binary, (character) => character.charCodeAt(0));
	} catch {
		return undefined;
	}
}

function base64UrlEncodeText(value: string): string {
	return base64UrlEncode(encoder.encode(value));
}

async function hmacKey(signingKey: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		encoder.encode(signingKey),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

async function sign(message: string, signingKey: string): Promise<string> {
	const signature = await crypto.subtle.sign(
		"HMAC",
		await hmacKey(signingKey),
		encoder.encode(message),
	);

	return base64UrlEncode(signature);
}

async function verify(message: string, signature: string, signingKey: string): Promise<boolean> {
	const bytes = base64UrlDecode(signature);
	if (!bytes) return false;

	return crypto.subtle.verify(
		"HMAC",
		await hmacKey(signingKey),
		bytes as unknown as ArrayBuffer,
		encoder.encode(message),
	);
}

/** The message a client secret signs. Namespaced so it can never collide with a token. */
function clientSecretMessage(clientId: string): string {
	return `client:${clientId}`;
}

export async function deriveClientSecret(clientId: string, signingKey: string): Promise<string> {
	return sign(clientSecretMessage(clientId), signingKey);
}

export async function clientSecretMatches(
	clientId: string,
	clientSecret: string,
	signingKey: string,
): Promise<boolean> {
	return verify(clientSecretMessage(clientId), clientSecret, signingKey);
}

export interface AccessTokenClaims {
	iss: string;
	sub: string;
	aud: string;
	scope: string;
	iat: number;
	exp: number;
}

const JWT_HEADER = base64UrlEncodeText(JSON.stringify({ alg: "HS256", typ: "JWT" }));

export async function signAccessToken(
	claims: AccessTokenClaims,
	signingKey: string,
): Promise<string> {
	const signingInput = `${JWT_HEADER}.${base64UrlEncodeText(JSON.stringify(claims))}`;

	return `${signingInput}.${await sign(signingInput, signingKey)}`;
}

/**
 * Returns the claims only when the signature checks out. A malformed token is
 * indistinguishable from a forged one to the caller, which is the point: both
 * mean "do not trust this".
 */
export async function readSignedAccessToken(
	token: string,
	signingKey: string,
): Promise<AccessTokenClaims | undefined> {
	const parts = token.split(".");
	if (parts.length !== 3) return undefined;

	const [header, payload, signature] = parts;
	if (!header || !payload || !signature) return undefined;
	if (!(await verify(`${header}.${payload}`, signature, signingKey))) return undefined;

	const decoded = base64UrlDecode(payload);
	if (!decoded) return undefined;

	try {
		return JSON.parse(new TextDecoder().decode(decoded)) as AccessTokenClaims;
	} catch {
		return undefined;
	}
}
