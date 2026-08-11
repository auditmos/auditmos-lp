import { z } from "astro/zod";

interface ContactEnv {
	CONTACT_TO_EMAIL: string;
	RESEND_API_KEY: string;
	TURNSTILE_SECRET_KEY: string;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ContactHandlerDependencies {
	env: ContactEnv;
	fetch: FetchLike;
	logger?: Pick<Console, "error" | "info">;
}

/**
 * Build the handler dependencies for the Worker runtime. The fetch wrapper is
 * load-bearing: passing the global `fetch` by reference and invoking it as
 * `deps.fetch(...)` rebinds `this`, which workerd rejects with
 * "TypeError: Illegal invocation" (Node's fetch does not, so only the real
 * runtime catches it). The arrow wrapper always calls through `globalThis`.
 */
export function createContactHandlerDependencies(
	env: ContactEnv,
	logger?: Pick<Console, "error" | "info">,
): ContactHandlerDependencies {
	return {
		env,
		logger,
		fetch: (input, init) => globalThis.fetch(input, init),
	};
}

const contactInputSchema = z
	.object({
		email: z.email(),
		message: z.string().trim().min(1),
		name: z.string().trim().min(1),
		turnstileToken: z.string().optional().default(""),
	})
	.strict();

type ContactInput = z.infer<typeof contactInputSchema>;

interface ResendEmail {
	from: string;
	reply_to?: string[];
	subject: string;
	text: string;
	to: string[];
}

const UNPARSEABLE = Symbol("unparseable");

async function readJson(source: Request | Response): Promise<unknown> {
	try {
		return await source.json();
	} catch {
		return UNPARSEABLE;
	}
}

function json(body: unknown, status: number): Response {
	return Response.json(body, { status });
}

async function verifyTurnstile(
	token: string,
	request: Request,
	deps: ContactHandlerDependencies,
): Promise<boolean> {
	const formData = new FormData();
	formData.set("secret", deps.env.TURNSTILE_SECRET_KEY);
	formData.set("response", token);

	const remoteIp =
		request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For");
	if (remoteIp) {
		formData.set("remoteip", remoteIp);
	}

	const response = await deps.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
		method: "POST",
		body: formData,
	});

	if (!response.ok) return false;

	const result = (await response.json()) as { success?: boolean };
	return result.success === true;
}

/**
 * The outcome of one Resend API call. `ok` only means Resend *accepted* the
 * message — it can still be dropped afterwards (suppression list, recipient-side
 * quarantine), so the id is the only handle a later investigation has. Discarding
 * it, and the rejection detail, is what makes vanished mail undiagnosable.
 */
type ResendDispatch = { ok: true; id: string } | { ok: false; detail: string; status: number };

async function sendResendEmail(
	email: ResendEmail,
	deps: ContactHandlerDependencies,
): Promise<ResendDispatch> {
	const response = await deps.fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${deps.env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(email),
	});

	const payload = await readJson(response);

	if (!response.ok) {
		return { ok: false, detail: describeResendError(payload), status: response.status };
	}

	return { ok: true, id: readStringField(payload, "id") ?? "" };
}

function readStringField(payload: unknown, field: string): string | undefined {
	if (typeof payload !== "object" || payload === null) return undefined;

	const value = (payload as Record<string, unknown>)[field];
	return typeof value === "string" && value !== "" ? value : undefined;
}

/** Resend rejections carry `{ name, message }`; edge failures carry neither. */
function describeResendError(payload: unknown): string {
	const message = readStringField(payload, "message");
	if (!message) return "unparseable Resend response";

	const name = readStringField(payload, "name");
	return name ? `${name}: ${message}` : message;
}

function notificationEmail(input: ContactInput, env: ContactEnv): ResendEmail {
	return {
		from: "Auditmos <noreply@auditmos.com>",
		reply_to: [input.email],
		to: [env.CONTACT_TO_EMAIL],
		subject: `New Auditmos contact inquiry from ${input.name}`,
		text: [
			"New contact form submission:",
			"",
			`Name: ${input.name}`,
			`Email: ${input.email}`,
			"",
			input.message,
		].join("\n"),
	};
}

function confirmationEmail(input: ContactInput, env: ContactEnv): ResendEmail {
	return {
		from: "Auditmos <noreply@auditmos.com>",
		to: [input.email],
		subject: "Auditmos received your message",
		text: [
			"Thanks for contacting Auditmos.",
			"",
			`We received your message and will reply from ${env.CONTACT_TO_EMAIL}.`,
			"",
			"Your message:",
			input.message,
		].join("\n"),
	};
}

export async function handleContactRequest(
	request: Request,
	deps: ContactHandlerDependencies,
): Promise<Response> {
	if (request.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405,
			headers: {
				Allow: "POST",
				"Content-Type": "application/json",
			},
		});
	}

	const parsed = contactInputSchema.safeParse(await readJson(request));
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0]?.message ?? "Invalid contact form payload" }, 400);
	}

	const turnstileToken = parsed.data.turnstileToken.trim();
	if (!turnstileToken) {
		return json({ error: "Anti-spam verification failed" }, 403);
	}

	const turnstileOk = await verifyTurnstile(turnstileToken, request, deps);
	if (!turnstileOk) {
		return json({ error: "Anti-spam verification failed" }, 403);
	}

	const audit = {
		recipient: deps.env.CONTACT_TO_EMAIL,
		submitter: parsed.data.email,
	};

	const notification = await sendResendEmail(notificationEmail(parsed.data, deps.env), deps);
	if (!notification.ok) {
		deps.logger?.error("contact_email_failed", {
			detail: notification.detail,
			stage: "notification",
			status: notification.status,
			...audit,
		});

		return json({ error: "Email delivery failed" }, 502);
	}

	const confirmation = await sendResendEmail(confirmationEmail(parsed.data, deps.env), deps);
	if (!confirmation.ok) {
		deps.logger?.error("contact_email_failed", {
			detail: confirmation.detail,
			stage: "confirmation",
			status: confirmation.status,
			...audit,
		});
		deps.logger?.error("contact_email_inconsistency", {
			confirmationSent: false,
			notificationSent: true,
			...audit,
		});

		return json({ error: "Email delivery failed" }, 502);
	}

	deps.logger?.info("contact_email_dispatched", {
		confirmationId: confirmation.id,
		notificationId: notification.id,
		...audit,
	});

	return json({ ok: true }, 200);
}
