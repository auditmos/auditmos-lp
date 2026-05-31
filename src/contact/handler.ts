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
	logger?: Pick<Console, "error">;
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

async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return undefined;
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

async function sendResendEmail(
	email: ResendEmail,
	deps: ContactHandlerDependencies,
): Promise<boolean> {
	const response = await deps.fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${deps.env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(email),
	});

	return response.ok;
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

function confirmationEmail(input: ContactInput): ResendEmail {
	return {
		from: "Auditmos <noreply@auditmos.com>",
		to: [input.email],
		subject: "Auditmos received your message",
		text: [
			"Thanks for contacting Auditmos.",
			"",
			"We received your message and will reply from contact@auditmos.com.",
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

	const notificationSent = await sendResendEmail(notificationEmail(parsed.data, deps.env), deps);
	const confirmationSent =
		notificationSent && (await sendResendEmail(confirmationEmail(parsed.data), deps));

	if (!notificationSent || !confirmationSent) {
		if (notificationSent && !confirmationSent) {
			deps.logger?.error("contact_email_inconsistency", {
				confirmationSent,
				notificationSent,
				recipient: deps.env.CONTACT_TO_EMAIL,
				submitter: parsed.data.email,
			});
		}

		return json({ error: "Email delivery failed" }, 502);
	}

	return json({ ok: true }, 200);
}
