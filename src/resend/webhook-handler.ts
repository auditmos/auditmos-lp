/**
 * The sink for Resend delivery events.
 *
 * Why this endpoint exists: Resend answers a *suppressed* send with `200 OK`
 * and a message id — byte for byte the response a delivered message gets. That
 * is not an oversight; by the time Resend decides not to deliver, it has
 * already replied. So no amount of logging in `/api/contact` can distinguish
 * "sent" from "silently dropped": the outcome only exists asynchronously, and
 * this webhook is the only channel that carries it. Contact notifications
 * vanished for four days behind a 200 before this was written (see the PRD).
 *
 * What lands in the log is a bounded projection of the event — type, message
 * id, recipients, bounce reason — never the raw body.
 */

import { z } from "astro/zod";

/** The shape of a Cloudflare rate-limit binding, narrowed to what is used. */
interface RateLimiter {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface ResendWebhookDependencies {
	/** Absent in `astro dev`, where no Workers runtime is in play. */
	limiter?: RateLimiter;
	logger?: Pick<Console, "error" | "info" | "warn">;
	/** Injected so the replay window is testable without waiting on the clock. */
	now?: () => number;
	/** Resend's Svix signing secret, `whsec_`-prefixed. Empty means fail closed. */
	secret: string;
}

/**
 * Per-client ceiling. Resend bursts several events per message (sent →
 * delivered → opened), so this sits well above the site's real volume and
 * bounds only a flood; Resend retries anything it answers 429.
 *
 * Must match `RESEND_WEBHOOK_RATE_LIMITER` in wrangler.jsonc, which is declared
 * in every env block because bindings are not inherited. Change them together.
 */
const RESEND_WEBHOOK_RATE_LIMIT = { requests: 120, windowSeconds: 60 } as const;

/**
 * How far a signed payload may be from now. Svix's own default. Bounds replay:
 * a captured request stops verifying once the window closes, and the signature
 * covers the timestamp so it cannot be advanced without the secret.
 */
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Events that mean a message the site believed it had sent will never arrive.
 * These are the reason the endpoint exists, so they are the only ones that
 * reach the log at `error`.
 */
const FAILURE_EVENTS = new Set([
	"email.bounced",
	"email.failed",
	"email.suppressed",
	"suppression.added",
]);

/** Delivered, but degraded — worth attention, not an outage. */
const WARNING_EVENTS = new Set(["email.complained", "email.delivery_delayed"]);

/**
 * Deliberately permissive: `type` and `data` are the whole contract. Resend
 * adds event types over time, and a schema strict enough to reject an unknown
 * one would discard precisely the payload that documents something new.
 */
const resendEventSchema = z.object({
	// No `.passthrough()`: unknown keys are ignored rather than rejected by
	// default, and nothing here reads a field it did not name.
	data: z.object({
		bounce: z
			.object({
				message: z.string().optional(),
				type: z.string().optional(),
			})
			.optional(),
		email: z.string().optional(),
		email_id: z.string().optional(),
		subject: z.string().optional(),
		to: z.array(z.string()).optional(),
	}),
	type: z.string().min(1),
});

/** Rate limiting bounds how many events arrive; this bounds how large one may be. */
const MAX_LOGGED_FIELD_LENGTH = 256;

function bounded(value: string | undefined): string | undefined {
	return value?.slice(0, MAX_LOGGED_FIELD_LENGTH);
}

/**
 * No binding (local dev) or no client address to charge: fail open rather than
 * refuse events, since losing them is the failure this endpoint exists to
 * avoid. Same call as `@/csp/report-handler`.
 */
async function withinLimit(request: Request, limiter: RateLimiter | undefined): Promise<boolean> {
	const key = request.headers.get("cf-connecting-ip");
	if (!limiter || !key) return true;

	return (await limiter.limit({ key })).success;
}

/** Resend white-labels the Svix headers on some plans; both spellings are read. */
function signatureHeader(request: Request, name: string): string {
	return request.headers.get(`svix-${name}`) ?? request.headers.get(`webhook-${name}`) ?? "";
}

/**
 * Returns `Uint8Array<ArrayBuffer>` rather than the `Uint8Array.from` default:
 * that widens to `ArrayBufferLike`, which `importKey` rejects because a
 * `SharedArrayBuffer` is not a valid key source.
 */
function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes;
}

function encodeBase64(bytes: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

/**
 * Length-independent, content-constant-time comparison. Signatures are public
 * once sent, but comparing them with `===` leaks how far a forgery matched,
 * which is enough to construct one byte by byte.
 */
function equalsInConstantTime(left: string, right: string): boolean {
	if (left.length !== right.length) return false;

	let difference = 0;
	for (let index = 0; index < left.length; index++) {
		difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}

	return difference === 0;
}

/**
 * Svix's scheme: HMAC-SHA256 over `id.timestamp.body`, keyed on the base64 body
 * of the `whsec_` secret. The header carries a space-delimited list of
 * `version,signature` pairs — during a secret rotation more than one is valid.
 */
async function hasValidSignature(
	rawBody: string,
	request: Request,
	secret: string,
): Promise<boolean> {
	const id = signatureHeader(request, "id");
	const timestamp = signatureHeader(request, "timestamp");
	const provided = signatureHeader(request, "signature");
	if (!id || !timestamp || !provided) return false;

	let expected: string;
	try {
		const key = await crypto.subtle.importKey(
			"raw",
			decodeBase64(secret.replace(/^whsec_/, "")),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const mac = await crypto.subtle.sign(
			"HMAC",
			key,
			new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
		);
		expected = encodeBase64(mac);
	} catch {
		// A secret that is not valid base64 can never verify anything.
		return false;
	}

	return provided
		.split(" ")
		.filter((entry) => entry.startsWith("v1,"))
		.some((entry) => equalsInConstantTime(entry.slice("v1,".length), expected));
}

/** Outside the tolerance, or not a number at all: the payload is a replay. */
function timestampIsFresh(request: Request, now: number): boolean {
	const timestamp = Number(signatureHeader(request, "timestamp"));
	if (!Number.isFinite(timestamp)) return false;

	return Math.abs(now / 1000 - timestamp) <= TIMESTAMP_TOLERANCE_SECONDS;
}

export async function handleResendWebhook(
	request: Request,
	deps: ResendWebhookDependencies,
): Promise<Response> {
	if (request.method !== "POST") {
		return new Response(null, { status: 405, headers: { Allow: "POST" } });
	}

	// Fail closed. An unverified sink is a log-injection endpoint: anyone could
	// forge a `delivered` for a message that bounced, or bury a real failure.
	if (!deps.secret) {
		deps.logger?.error("resend_webhook_misconfigured", {
			reason: "missing signing secret",
		});

		return new Response(null, { status: 500 });
	}

	// Before the body is read, so a flood costs nothing but the limiter call.
	if (!(await withinLimit(request, deps.limiter))) {
		return new Response(null, {
			status: 429,
			headers: { "Retry-After": String(RESEND_WEBHOOK_RATE_LIMIT.windowSeconds) },
		});
	}

	if (!timestampIsFresh(request, deps.now?.() ?? Date.now())) {
		return new Response(null, { status: 400 });
	}

	// The raw text, never a re-serialized parse: the signature covers the exact
	// bytes Resend sent, and `JSON.stringify(JSON.parse(body))` is not those.
	const rawBody = await request.text();

	if (!(await hasValidSignature(rawBody, request, deps.secret))) {
		return new Response(null, { status: 401 });
	}

	let payload: unknown;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		return new Response(null, { status: 400 });
	}

	const parsed = resendEventSchema.safeParse(payload);
	if (!parsed.success) {
		return new Response(null, { status: 400 });
	}

	const { data, type } = parsed.data;
	const fields = {
		bounceMessage: bounded(data.bounce?.message),
		bounceType: bounded(data.bounce?.type),
		emailId: bounded(data.email_id),
		recipients: data.to ?? (data.email ? [data.email] : undefined),
		subject: bounded(data.subject),
		type: bounded(type),
	};

	if (FAILURE_EVENTS.has(type)) {
		deps.logger?.error("resend_delivery_event", fields);
	} else if (WARNING_EVENTS.has(type)) {
		deps.logger?.warn("resend_delivery_event", fields);
	} else {
		deps.logger?.info("resend_delivery_event", fields);
	}

	return new Response(null, { status: 204 });
}
