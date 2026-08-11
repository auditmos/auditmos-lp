/**
 * The sink for `Content-Security-Policy-Report-Only` violation reports.
 *
 * The point of the report-only phase: a browser that would have refused a
 * resource says so here instead, and the policy is corrected before it is
 * enforced. What lands in the log is a bounded projection of the report — the
 * directive, what was blocked, and where — never the whole body, which is
 * attacker-influenced and unbounded.
 */

import { z } from "astro/zod";

/** The shape of a Cloudflare rate-limit binding, narrowed to what is used. */
interface RateLimiter {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface CspReportDependencies {
	/** Absent in `astro dev`, where no Workers runtime is in play. */
	limiter?: RateLimiter;
	logger?: Pick<Console, "warn">;
}

/**
 * Per-client ceiling on reports. Browsers already deduplicate violations within
 * a document, so a visitor browsing normally stays far under this even while
 * the policy is still wrong; what it bounds is a script POSTing here in a loop.
 *
 * Must match `CSP_REPORT_RATE_LIMITER` in wrangler.jsonc, which is declared in
 * every env block because bindings are not inherited. Nothing can catch the two
 * drifting apart, so change them together.
 */
const CSP_REPORT_RATE_LIMIT = { requests: 60, windowSeconds: 60 } as const;

/**
 * No binding (local dev) or no client address to charge: fail open rather than
 * refuse reports, since losing them is the failure this endpoint exists to
 * avoid. Same call as `@/mcp/access`.
 */
async function withinLimit(request: Request, limiter: RateLimiter | undefined): Promise<boolean> {
	const key = request.headers.get("cf-connecting-ip");
	if (!limiter || !key) return true;

	return (await limiter.limit({ key })).success;
}

/**
 * The `report-uri` payload. Every field is optional because browsers disagree
 * about which they send; the envelope key is what distinguishes a real report
 * from a POST of arbitrary JSON.
 */
const cspReportSchema = z.object({
	"csp-report": z.object({
		"blocked-uri": z.string().optional(),
		"document-uri": z.string().optional(),
		"effective-directive": z.string().optional(),
		"violated-directive": z.string().optional(),
	}),
});

/**
 * Rate limiting bounds how many reports arrive; this bounds how large one may
 * be. Truncated from the end, since the informative part of a URL or a
 * directive name is its beginning.
 */
const MAX_LOGGED_FIELD_LENGTH = 256;

function bounded(value: string | undefined): string | undefined {
	return value?.slice(0, MAX_LOGGED_FIELD_LENGTH);
}

async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return undefined;
	}
}

export async function handleCspReport(
	request: Request,
	deps: CspReportDependencies,
): Promise<Response> {
	if (request.method !== "POST") {
		return new Response(null, { status: 405, headers: { Allow: "POST" } });
	}

	// Before the body is read, so a flood costs nothing but the limiter call.
	if (!(await withinLimit(request, deps.limiter))) {
		return new Response(null, {
			status: 429,
			headers: { "Retry-After": String(CSP_REPORT_RATE_LIMIT.windowSeconds) },
		});
	}

	const parsed = cspReportSchema.safeParse(await readJson(request));

	if (!parsed.success) {
		return new Response(null, { status: 400 });
	}

	const report = parsed.data["csp-report"];

	deps.logger?.warn("csp_violation", {
		blockedUri: bounded(report["blocked-uri"]),
		documentUri: bounded(report["document-uri"]),
		effectiveDirective: bounded(report["effective-directive"]),
		violatedDirective: bounded(report["violated-directive"]),
	});

	return new Response(null, { status: 204 });
}
