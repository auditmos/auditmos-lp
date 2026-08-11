import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { createContactHandlerDependencies, handleContactRequest } from "@/contact/handler";

export const prerender = false;

const logger = {
	error(message: string, fields: Record<string, unknown>) {
		// biome-ignore lint/suspicious/noConsole: Worker structured logs are required for partial email delivery failures.
		console.error(message, fields);
	},
	info(message: string, fields: Record<string, unknown>) {
		// biome-ignore lint/suspicious/noConsole: the Resend message id is the only handle for tracing a submission that Resend accepted but never delivered.
		console.info(message, fields);
	},
};

const contactRoute: APIRoute = ({ request }) =>
	handleContactRequest(request, createContactHandlerDependencies(env, logger));

export const DELETE = contactRoute;
export const GET = contactRoute;
export const OPTIONS = contactRoute;
export const PATCH = contactRoute;
export const POST = contactRoute;
export const PUT = contactRoute;
