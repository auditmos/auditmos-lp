/**
 * Where Resend posts delivery events.
 *
 * A request-time route, and a deliberate exception to the site's static-first
 * rule (see the PRD): a webhook is an inbound POST whose signature must be
 * verified against its raw body, and a prerendered asset can do neither. It
 * exists because Resend answers a suppressed send with the same `200 OK` as a
 * delivered one — the failure only exists asynchronously, and this is the only
 * channel that carries it. All logic lives in `@/resend/webhook-handler`; this
 * file only does HTTP.
 */

import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { handleResendWebhook } from "@/resend/webhook-handler";

export const prerender = false;

const logger = {
	error(message: string, fields: Record<string, unknown>) {
		// biome-ignore lint/suspicious/noConsole: the Workers log is the delivery-failure sink.
		console.error(message, fields);
	},
	info(message: string, fields: Record<string, unknown>) {
		// biome-ignore lint/suspicious/noConsole: successful deliveries are the baseline a failure is read against.
		console.info(message, fields);
	},
	warn(message: string, fields: Record<string, unknown>) {
		// biome-ignore lint/suspicious/noConsole: the Workers log is the delivery-failure sink.
		console.warn(message, fields);
	},
};

// Every method routes through the handler so it can answer 405 with `Allow`
// itself, rather than letting Astro 404 a wrong verb. Same shape as
// `api/csp-report.ts`.
const webhookRoute: APIRoute = ({ request }) =>
	handleResendWebhook(request, {
		limiter: env.RESEND_WEBHOOK_RATE_LIMITER,
		logger,
		secret: env.RESEND_WEBHOOK_SECRET ?? "",
	});

export const DELETE = webhookRoute;
export const GET = webhookRoute;
export const OPTIONS = webhookRoute;
export const PATCH = webhookRoute;
export const POST = webhookRoute;
export const PUT = webhookRoute;
