/**
 * TDD assumptions for issue #6:
 * - The tested public interface is `handleContactRequest(request, deps)`.
 * - Valid input is a JSON POST body with `name`, `email`, `message`, and `turnstileToken`.
 * - Output is JSON with explicit HTTP statuses; callers only observe all-or-error email behavior.
 * - Boundary failures return before external calls; Turnstile and Resend are the only mocked boundaries.
 * - This unit does not test the Astro page wrapper, real dashboard secrets, DNS verification,
 *   or staging inbox delivery.
 */

import {
	type ContactHandlerDependencies,
	createContactHandlerDependencies,
	handleContactRequest,
} from "./handler";

const env = {
	CONTACT_TO_EMAIL: "contact@auditmos.com",
	RESEND_API_KEY: "re_test",
	TURNSTILE_SECRET_KEY: "turnstile-secret",
} as const;

const validPayload = {
	name: "Jane Buyer",
	email: "jane@example.com",
	message: "We need a security review before procurement.",
	turnstileToken: "valid-turnstile-token",
} as const;

function jsonRequest(body: unknown, method = "POST"): Request {
	const init: RequestInit = {
		method,
		headers: {
			"Content-Type": "application/json",
			"CF-Connecting-IP": "203.0.113.10",
		},
	};

	if (method !== "GET" && method !== "HEAD") {
		init.body = JSON.stringify(body);
	}

	return new Request("https://auditmos.com/api/contact", {
		...init,
	});
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
		...init,
	});
}

describe("handleContactRequest", () => {
	it("returns 405 for methods other than POST", async () => {
		const fetch = vi.fn<ContactHandlerDependencies["fetch"]>();

		const response = await handleContactRequest(jsonRequest(validPayload, "GET"), { env, fetch });

		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBe("POST");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("returns 200 and dispatches both emails after a valid Turnstile verification", async () => {
		const fetch = vi
			.fn<ContactHandlerDependencies["fetch"]>()
			.mockResolvedValueOnce(jsonResponse({ success: true }))
			.mockResolvedValue(jsonResponse({ id: "email-id" }));

		const response = await handleContactRequest(jsonRequest(validPayload), { env, fetch });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(fetch).toHaveBeenCalledTimes(3);
		expect(fetch.mock.calls[0]?.[0]).toBe(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		);

		const resendBodies = fetch.mock.calls
			.slice(1)
			.map(([, init]) => JSON.parse(String(init?.body)) as { to: string[]; subject: string });

		expect(resendBodies.map((body) => body.to)).toEqual([
			["contact@auditmos.com"],
			["jane@example.com"],
		]);
		expect(resendBodies[0]?.subject).toContain("Jane Buyer");
		expect(resendBodies[1]?.subject).toContain("Auditmos received your message");
	});

	it.each([
		["missing name", { ...validPayload, name: "" }],
		["malformed email", { ...validPayload, email: "not-an-email" }],
	])("returns 400 and skips external calls for %s", async (_case, payload) => {
		const fetch = vi.fn<ContactHandlerDependencies["fetch"]>();

		const response = await handleContactRequest(jsonRequest(payload), { env, fetch });

		expect(response.status).toBe(400);
		expect(await response.json()).toHaveProperty("error");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("returns 403 and does not send email when the Turnstile token is missing", async () => {
		const fetch = vi.fn<ContactHandlerDependencies["fetch"]>();

		const response = await handleContactRequest(
			jsonRequest({ ...validPayload, turnstileToken: "" }),
			{ env, fetch },
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: "Anti-spam verification failed" });
		expect(fetch).not.toHaveBeenCalled();
	});

	it("returns 403 and skips Resend when Turnstile rejects the token", async () => {
		const fetch = vi
			.fn<ContactHandlerDependencies["fetch"]>()
			.mockResolvedValueOnce(
				jsonResponse({ success: false, "error-codes": ["timeout-or-duplicate"] }),
			);

		const response = await handleContactRequest(jsonRequest(validPayload), { env, fetch });

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: "Anti-spam verification failed" });
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it("returns 502 when the notification email fails", async () => {
		const fetch = vi
			.fn<ContactHandlerDependencies["fetch"]>()
			.mockResolvedValueOnce(jsonResponse({ success: true }))
			.mockResolvedValueOnce(jsonResponse({ error: "Resend unavailable" }, { status: 503 }));

		const response = await handleContactRequest(jsonRequest(validPayload), { env, fetch });

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: "Email delivery failed" });
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("returns 502 and logs an inconsistency when confirmation fails after notification succeeds", async () => {
		const fetch = vi
			.fn<ContactHandlerDependencies["fetch"]>()
			.mockResolvedValueOnce(jsonResponse({ success: true }))
			.mockResolvedValueOnce(jsonResponse({ id: "notification-id" }))
			.mockResolvedValueOnce(jsonResponse({ error: "Resend unavailable" }, { status: 503 }));
		const logger = { error: vi.fn(), info: vi.fn() };

		const response = await handleContactRequest(jsonRequest(validPayload), {
			env,
			fetch,
			logger,
		});

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: "Email delivery failed" });
		expect(logger.error).toHaveBeenCalledWith("contact_email_inconsistency", {
			confirmationSent: false,
			notificationSent: true,
			recipient: "contact@auditmos.com",
			submitter: "jane@example.com",
		});
	});
});

describe("createContactHandlerDependencies", () => {
	// workerd throws "Illegal invocation" when a platform function like fetch is
	// invoked with a foreign `this` (e.g. as `deps.fetch(...)`). Node's fetch
	// tolerates it, so this stub reproduces the runtime behavior the regression
	// guards against.
	function thisStrictFetch(this: unknown): Promise<Response> {
		if (this !== globalThis && this !== undefined) {
			throw new TypeError("Illegal invocation");
		}

		return Promise.resolve(jsonResponse({ ok: true }));
	}

	beforeEach(() => {
		vi.stubGlobal("fetch", thisStrictFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("provides a fetch that survives method-style invocation", async () => {
		const deps = createContactHandlerDependencies(env);

		await expect(deps.fetch("https://challenges.cloudflare.com/")).resolves.toBeInstanceOf(
			Response,
		);
	});

	it("documents the failure mode the wrapper prevents: a bare fetch reference throws", () => {
		const bare: ContactHandlerDependencies = { env, fetch };

		expect(() => bare.fetch("https://challenges.cloudflare.com/")).toThrow(/Illegal invocation/);
	});

	it("threads env and logger through unchanged", () => {
		const logger = { error: vi.fn(), info: vi.fn() };
		const deps = createContactHandlerDependencies(env, logger);

		expect(deps.env).toBe(env);
		expect(deps.logger).toBe(logger);
	});
});

describe("Resend dispatch observability", () => {
	// Resend accepts a message with 200 + id and can still drop it later
	// (suppression list, recipient-side quarantine). Without the id in the
	// Worker log there is nothing to look the submission up by, which is
	// exactly what blocked diagnosing mail that never reached the inbox.
	it("logs the Resend message id for both sends when delivery is accepted", async () => {
		const fetch = vi
			.fn<ContactHandlerDependencies["fetch"]>()
			.mockResolvedValueOnce(jsonResponse({ success: true }))
			.mockResolvedValueOnce(jsonResponse({ id: "notification-id" }))
			.mockResolvedValueOnce(jsonResponse({ id: "confirmation-id" }));
		const logger = { error: vi.fn(), info: vi.fn() };

		const response = await handleContactRequest(jsonRequest(validPayload), {
			env,
			fetch,
			logger,
		});

		expect(response.status).toBe(200);
		expect(logger.info).toHaveBeenCalledWith("contact_email_dispatched", {
			confirmationId: "confirmation-id",
			notificationId: "notification-id",
			recipient: "contact@auditmos.com",
			submitter: "jane@example.com",
		});
		expect(logger.error).not.toHaveBeenCalled();
	});

	it("logs the status and Resend error detail when a send is rejected", async () => {
		const fetch = vi
			.fn<ContactHandlerDependencies["fetch"]>()
			.mockResolvedValueOnce(jsonResponse({ success: true }))
			.mockResolvedValueOnce(
				jsonResponse(
					{ message: "The auditmos.com domain is not verified", name: "validation_error" },
					{ status: 422 },
				),
			);
		const logger = { error: vi.fn(), info: vi.fn() };

		const response = await handleContactRequest(jsonRequest(validPayload), {
			env,
			fetch,
			logger,
		});

		expect(response.status).toBe(502);
		expect(logger.error).toHaveBeenCalledWith("contact_email_failed", {
			detail: "validation_error: The auditmos.com domain is not verified",
			recipient: "contact@auditmos.com",
			stage: "notification",
			status: 422,
			submitter: "jane@example.com",
		});
	});

	it("reports a non-JSON Resend rejection without throwing", async () => {
		const fetch = vi
			.fn<ContactHandlerDependencies["fetch"]>()
			.mockResolvedValueOnce(jsonResponse({ success: true }))
			.mockResolvedValueOnce(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
		const logger = { error: vi.fn(), info: vi.fn() };

		const response = await handleContactRequest(jsonRequest(validPayload), {
			env,
			fetch,
			logger,
		});

		expect(response.status).toBe(502);
		expect(logger.error).toHaveBeenCalledWith("contact_email_failed", {
			detail: "unparseable Resend response",
			recipient: "contact@auditmos.com",
			stage: "notification",
			status: 502,
			submitter: "jane@example.com",
		});
	});

	it("attributes the failure to the confirmation stage when only it is rejected", async () => {
		const fetch = vi
			.fn<ContactHandlerDependencies["fetch"]>()
			.mockResolvedValueOnce(jsonResponse({ success: true }))
			.mockResolvedValueOnce(jsonResponse({ id: "notification-id" }))
			.mockResolvedValueOnce(
				jsonResponse(
					{ message: "Rate limit exceeded", name: "rate_limit_exceeded" },
					{ status: 429 },
				),
			);
		const logger = { error: vi.fn(), info: vi.fn() };

		await handleContactRequest(jsonRequest(validPayload), { env, fetch, logger });

		expect(logger.error).toHaveBeenCalledWith("contact_email_failed", {
			detail: "rate_limit_exceeded: Rate limit exceeded",
			recipient: "contact@auditmos.com",
			stage: "confirmation",
			status: 429,
			submitter: "jane@example.com",
		});
	});
});

describe("confirmation email reply address", () => {
	it("references the configured CONTACT_TO_EMAIL instead of a hardcoded address", async () => {
		const customEnv = { ...env, CONTACT_TO_EMAIL: "tom@auditmos.com" };
		const fetch = vi
			.fn<ContactHandlerDependencies["fetch"]>()
			.mockResolvedValueOnce(jsonResponse({ success: true }))
			.mockResolvedValue(jsonResponse({ id: "email-id" }));

		await handleContactRequest(jsonRequest(validPayload), { env: customEnv, fetch });

		const confirmationBody = JSON.parse(String(fetch.mock.calls[2]?.[1]?.body)) as {
			text: string;
		};

		expect(confirmationBody.text).toContain("tom@auditmos.com");
		expect(confirmationBody.text).not.toContain("contact@auditmos.com");
	});
});
