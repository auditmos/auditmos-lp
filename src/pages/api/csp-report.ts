/**
 * Where browsers post Content Security Policy violations.
 *
 * A request-time route, and a deliberate exception to the site's static-first
 * rule (see the PRD): a prerendered asset cannot read a POST body, and a policy
 * shipped in report-only mode with nowhere to report is a policy nobody can
 * validate before enforcing it. All logic lives in `@/csp/report-handler`; this
 * file only does HTTP.
 */

import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { handleCspReport } from "@/csp/report-handler";

export const prerender = false;

const logger = {
	warn(message: string, fields: Record<string, unknown>) {
		// biome-ignore lint/suspicious/noConsole: the Workers log is the report sink.
		console.warn(message, fields);
	},
};

// Every method routes through the handler so it can answer 405 with `Allow`
// itself, rather than letting Astro 404 a wrong verb. Same shape as
// `api/contact.ts`.
const reportRoute: APIRoute = ({ request }) =>
	handleCspReport(request, { limiter: env.CSP_REPORT_RATE_LIMITER, logger });

export const DELETE = reportRoute;
export const GET = reportRoute;
export const OPTIONS = reportRoute;
export const PATCH = reportRoute;
export const POST = reportRoute;
export const PUT = reportRoute;
