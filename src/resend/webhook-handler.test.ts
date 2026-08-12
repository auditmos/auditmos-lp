/**
 * TDD assumptions:
 * - The tested public interface is `handleResendWebhook(request, deps)`.
 * - Signature verification is exercised through real WebCrypto HMAC, not a stub —
 *   a hand-rolled verifier whose tests mock the crypto proves nothing.
 * - `now` is injected so the timestamp tolerance is testable without waiting.
 * - This unit does not test the Astro page wrapper, the rate-limit binding
 *   itself, or Resend's delivery of the callback.
 */

import { handleResendWebhook, type ResendWebhookDependencies } from "./webhook-handler";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const NOW_SECONDS = 1_760_000_000;

async function sign(body: string, id: string, timestamp: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		Uint8Array.from(atob(SECRET.slice("whsec_".length)), (char) => char.charCodeAt(0)),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${id}.${timestamp}.${body}`),
	);

	return `v1,${btoa(String.fromCharCode(...new Uint8Array(mac)))}`;
}

interface RequestOptions {
	body?: unknown;
	id?: string;
	method?: string;
	signature?: string;
	timestamp?: number;
}

async function signedRequest(options: RequestOptions = {}): Promise<Request> {
	const id = options.id ?? "msg_2Xk9";
	const timestamp = String(options.timestamp ?? NOW_SECONDS);
	const body = JSON.stringify(
		options.body ?? {
			created_at: "2026-08-11T16:36:00.000Z",
			data: { email_id: "ab52e7cf", to: ["contact@auditmos.com"] },
			type: "email.sent",
		},
	);

	const method = options.method ?? "POST";

	return new Request("https://auditmos.com/api/resend-webhook", {
		method,
		headers: {
			"cf-connecting-ip": "203.0.113.10",
			"svix-id": id,
			"svix-signature": options.signature ?? (await sign(body, id, timestamp)),
			"svix-timestamp": timestamp,
		},
		// A GET/HEAD Request may not carry one, and the 405 path never reads it.
		...(method === "GET" || method === "HEAD" ? {} : { body }),
	});
}

function deps(overrides: Partial<ResendWebhookDependencies> = {}): ResendWebhookDependencies {
	return {
		logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
		now: () => NOW_SECONDS * 1000,
		secret: SECRET,
		...overrides,
	};
}

describe("handleResendWebhook", () => {
	it("returns 405 for methods other than POST", async () => {
		const response = await handleResendWebhook(await signedRequest({ method: "GET" }), deps());

		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBe("POST");
	});

	it("accepts a correctly signed event and answers 204", async () => {
		const response = await handleResendWebhook(await signedRequest(), deps());

		expect(response.status).toBe(204);
	});

	// Fail closed: an unauthenticated webhook sink lets anyone forge delivery
	// events into the log the on-call decision is made from.
	it("refuses every request when no signing secret is configured", async () => {
		const dependencies = deps({ secret: "" });

		const response = await handleResendWebhook(await signedRequest(), dependencies);

		expect(response.status).toBe(500);
		expect(dependencies.logger?.error).toHaveBeenCalledWith(
			"resend_webhook_misconfigured",
			expect.objectContaining({ reason: "missing signing secret" }),
		);
	});

	it.each([
		["a forged signature", { signature: "v1,YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3OA==" }],
		["a malformed signature header", { signature: "not-a-signature" }],
	])("rejects %s with 401", async (_case, options) => {
		const response = await handleResendWebhook(await signedRequest(options), deps());

		expect(response.status).toBe(401);
	});

	it("rejects a request whose body was altered after signing", async () => {
		const request = await signedRequest();
		const tampered = new Request(request, {
			body: JSON.stringify({ data: {}, type: "email.delivered" }),
			method: "POST",
		});

		const response = await handleResendWebhook(tampered, deps());

		expect(response.status).toBe(401);
	});

	it("rejects a replayed payload once it falls outside the timestamp tolerance", async () => {
		const request = await signedRequest({ timestamp: NOW_SECONDS - 601 });

		const response = await handleResendWebhook(request, deps());

		expect(response.status).toBe(400);
	});

	it("accepts a signature list that carries the matching version among others", async () => {
		const id = "msg_2Xk9";
		const timestamp = String(NOW_SECONDS);
		const body = JSON.stringify({ data: {}, type: "email.sent" });
		const valid = await sign(body, id, timestamp);
		const request = new Request("https://auditmos.com/api/resend-webhook", {
			method: "POST",
			headers: {
				"svix-id": id,
				"svix-signature": `v1,b3RoZXJzaWduYXR1cmVoZXJlMTIzNDU2Nzg5MGFiY2RlZg== ${valid}`,
				"svix-timestamp": timestamp,
			},
			body,
		});

		expect((await handleResendWebhook(request, deps())).status).toBe(204);
	});

	it("rate limits before reading the body", async () => {
		const limiter = { limit: vi.fn().mockResolvedValue({ success: false }) };

		const response = await handleResendWebhook(await signedRequest(), deps({ limiter }));

		expect(response.status).toBe(429);
		expect(response.headers.get("Retry-After")).toBe("60");
	});
});

describe("delivery event severity", () => {
	async function logEvent(type: string, data: Record<string, unknown> = {}) {
		const dependencies = deps();
		await handleResendWebhook(await signedRequest({ body: { data, type } }), dependencies);

		return dependencies.logger as Record<"error" | "info" | "warn", ReturnType<typeof vi.fn>>;
	}

	// The incident these levels exist for: a suppressed send is answered 200 by
	// the API, so `error` here is the only place it can surface as a failure.
	it.each([
		"email.bounced",
		"email.failed",
		"email.suppressed",
		"suppression.added",
	])("logs %s at error", async (type) => {
		const logger = await logEvent(type);

		expect(logger.error).toHaveBeenCalledWith(
			"resend_delivery_event",
			expect.objectContaining({ type }),
		);
		expect(logger.warn).not.toHaveBeenCalled();
		expect(logger.info).not.toHaveBeenCalled();
	});

	it.each(["email.complained", "email.delivery_delayed"])("logs %s at warn", async (type) => {
		const logger = await logEvent(type);

		expect(logger.warn).toHaveBeenCalledWith(
			"resend_delivery_event",
			expect.objectContaining({ type }),
		);
		expect(logger.error).not.toHaveBeenCalled();
	});

	it.each(["email.sent", "email.delivered", "email.opened"])("logs %s at info", async (type) => {
		const logger = await logEvent(type);

		expect(logger.info).toHaveBeenCalledWith(
			"resend_delivery_event",
			expect.objectContaining({ type }),
		);
		expect(logger.error).not.toHaveBeenCalled();
	});

	it("carries the message id and recipients so a log line maps to a Resend record", async () => {
		const logger = await logEvent("email.bounced", {
			bounce: { message: "550 5.1.1 user unknown", subType: "Suppressed", type: "Permanent" },
			email_id: "ab52e7cf-f1eb-4784-a958-50",
			subject: "New Auditmos contact inquiry",
			to: ["contact@auditmos.com"],
		});

		expect(logger.error).toHaveBeenCalledWith("resend_delivery_event", {
			bounceMessage: "550 5.1.1 user unknown",
			bounceType: "Permanent",
			emailId: "ab52e7cf-f1eb-4784-a958-50",
			recipients: ["contact@auditmos.com"],
			subject: "New Auditmos contact inquiry",
			type: "email.bounced",
		});
	});

	it("bounds an oversized field rather than logging it whole", async () => {
		const logger = await logEvent("email.bounced", { bounce: { message: "x".repeat(900) } });

		const fields = logger.error.mock.calls[0]?.[1] as { bounceMessage: string };
		expect(fields.bounceMessage).toHaveLength(256);
	});

	// An unknown event is still evidence; a schema strict enough to reject one
	// would drop exactly the payload Resend added since this was written.
	it("accepts an event type it has never seen and logs it at info", async () => {
		const logger = await logEvent("email.some_future_event");

		expect(logger.info).toHaveBeenCalledWith(
			"resend_delivery_event",
			expect.objectContaining({ type: "email.some_future_event" }),
		);
	});

	it("returns 400 when the signed body is not a Resend event", async () => {
		const response = await handleResendWebhook(
			await signedRequest({ body: { nothing: "useful" } }),
			deps(),
		);

		expect(response.status).toBe(400);
	});
});
