import { handleCspReport } from "./report-handler";

function violationBody(violation: Record<string, unknown> = {}): string {
	return JSON.stringify({
		"csp-report": {
			"blocked-uri": "inline",
			"document-uri": "https://auditmos.com/contact",
			"effective-directive": "script-src-elem",
			"violated-directive": "script-src-elem",
			...violation,
		},
	});
}

function reportRequest(body: string, headers: Record<string, string> = {}): Request {
	return new Request("https://auditmos.com/api/csp-report", {
		method: "POST",
		headers: { "Content-Type": "application/csp-report", ...headers },
		body,
	});
}

describe("handleCspReport", () => {
	it("accepts a violation report and logs what the policy refused", async () => {
		const warn = vi.fn();

		const response = await handleCspReport(reportRequest(violationBody()), { logger: { warn } });

		expect(response.status).toBe(204);
		expect(warn).toHaveBeenCalledWith(
			"csp_violation",
			expect.objectContaining({
				blockedUri: "inline",
				documentUri: "https://auditmos.com/contact",
				effectiveDirective: "script-src-elem",
			}),
		);
	});

	it("refuses any method but POST", async () => {
		// The route is unauthenticated and public, so it answers exactly one verb.
		// A GET here would otherwise be a free way to probe that it exists.
		const response = await handleCspReport(new Request("https://auditmos.com/api/csp-report"), {});

		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBe("POST");
	});

	it("stops logging once a client is over the limit", async () => {
		// The endpoint is unauthenticated and writes to the log on every call,
		// which makes it a way to spend the site's log budget for free. The limit
		// has to cut off the *logging*, not just the status code — a 429 that
		// still logged would defeat the whole purpose.
		const warn = vi.fn();
		const limiter = { limit: () => Promise.resolve({ success: false }) };

		const response = await handleCspReport(
			reportRequest(violationBody(), { "CF-Connecting-IP": "203.0.113.9" }),
			{ limiter, logger: { warn } },
		);

		expect(response.status).toBe(429);
		expect(warn).not.toHaveBeenCalled();
	});

	it("charges the limit to the reporting client, and fails open when it cannot", async () => {
		// Keyed on the caller, not on the endpoint: one noisy client must not cost
		// every other visitor their reports. With no binding at all — `astro dev`,
		// where no Workers runtime exists — reports still go through, because
		// losing them is the failure this endpoint exists to prevent.
		const limit = vi.fn(() => Promise.resolve({ success: true }));

		await handleCspReport(reportRequest(violationBody(), { "CF-Connecting-IP": "203.0.113.9" }), {
			limiter: { limit },
		});
		const unbound = await handleCspReport(reportRequest(violationBody()), {});

		expect(limit).toHaveBeenCalledWith({ key: "203.0.113.9" });
		expect(unbound.status).toBe(204);
	});

	it("bounds every field it logs, because the body is attacker-controlled", async () => {
		// Rate limiting bounds how many reports arrive; nothing bounds how large
		// one is. A valid envelope wrapping megabyte strings would otherwise be a
		// way to write megabytes into the site's logs, once per allowed request.
		const warn = vi.fn<(message: string, fields: Record<string, unknown>) => void>();
		const overlongUri = `https://auditmos.com/${"a".repeat(5_000)}`;

		await handleCspReport(reportRequest(violationBody({ "blocked-uri": overlongUri })), {
			logger: { warn },
		});
		const logged = (warn.mock.calls[0]?.[1] ?? {}) as Record<string, string>;

		expect(logged.blockedUri?.length).toBeLessThanOrEqual(256);
		// Truncated from the end: the useful part of a URL is its beginning.
		expect(logged.blockedUri?.startsWith("https://auditmos.com/aaa")).toBe(true);
	});

	it("refuses a POST that is not a violation report", async () => {
		// The envelope key is the whole check. Without it the endpoint is an open
		// pipe from any origin into the site's structured logs.
		const warn = vi.fn();

		const response = await handleCspReport(reportRequest('{"note":"hello"}'), { logger: { warn } });

		expect(response.status).toBe(400);
		expect(warn).not.toHaveBeenCalled();
	});
});
