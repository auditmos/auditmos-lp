/**
 * TDD assumptions for issue #34:
 * - The policy is a fixed document, so its exact bytes are the assertion.
 * - `mode: enforce` with a wrong MX list blocks inbound mail, so the MX list is
 *   pinned here and re-checked against live DNS by `pnpm mta-sts:verify`.
 * - The MTA-STS host serves the policy and nothing else — no path on it may
 *   become a second URL for a site document.
 */

import {
	buildMtaStsPolicy,
	compareMx,
	MTA_STS_MAX_AGE,
	MTA_STS_MODE,
	MTA_STS_POLICY_PATH,
	MX_HOSTS,
	mtaStsResponse,
	parsePolicyMxHosts,
} from "./mta-sts";

const policyUrl = `https://mta-sts.auditmos.com${MTA_STS_POLICY_PATH}`;

describe("buildMtaStsPolicy", () => {
	it("emits the RFC 8461 fields in order, CRLF-terminated", () => {
		expect(buildMtaStsPolicy()).toBe(
			"version: STSv1\r\n" +
				"mode: testing\r\n" +
				"mx: aspmx.l.google.com\r\n" +
				"mx: alt1.aspmx.l.google.com\r\n" +
				"mx: alt2.aspmx.l.google.com\r\n" +
				"mx: alt3.aspmx.l.google.com\r\n" +
				"mx: alt4.aspmx.l.google.com\r\n" +
				"max_age: 604800\r\n",
		);
	});

	it("declares every MX host, in the order the constant lists them", () => {
		expect(parsePolicyMxHosts(buildMtaStsPolicy())).toEqual([...MX_HOSTS]);
	});

	it("ships in testing mode — enforce with a wrong MX list blocks inbound mail", () => {
		// This is a gate, not a tautology: flipping the constant fails here, which
		// is the prompt to bump the `_mta-sts` TXT `id` in the same change. Without
		// a new id, senders keep enforcing the policy they already cached.
		expect(MTA_STS_MODE).toBe("testing");
		expect(MTA_STS_MAX_AGE).toBe(604800);
	});
});

describe("compareMx", () => {
	const dns = ["ASPMX.L.GOOGLE.COM.", "alt1.aspmx.l.google.com.", "alt2.aspmx.l.google.com."];

	it("matches ignoring case, trailing dots and order", () => {
		const result = compareMx(
			["alt2.aspmx.l.google.com", "aspmx.l.google.com", "alt1.aspmx.l.google.com"],
			dns,
		);

		expect(result.matches).toBe(true);
	});

	it("names an MX the policy omits — senders would refuse a valid host", () => {
		const result = compareMx(["aspmx.l.google.com", "alt1.aspmx.l.google.com"], dns);

		expect(result).toEqual({
			matches: false,
			missingFromPolicy: ["alt2.aspmx.l.google.com"],
			unexpectedInPolicy: [],
		});
	});

	it("names a host the policy still blesses after DNS dropped it", () => {
		const result = compareMx([...dns.map((h) => h.replace(/\.$/, "")), "old.mx.example"], dns);

		expect(result).toEqual({
			matches: false,
			missingFromPolicy: [],
			unexpectedInPolicy: ["old.mx.example"],
		});
	});

	it("does not call an empty DNS answer a match", () => {
		expect(compareMx([...MX_HOSTS], []).matches).toBe(false);
	});
});

describe("mtaStsResponse", () => {
	it("serves the policy as text/plain", async () => {
		const response = mtaStsResponse(new Request(policyUrl));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
		expect(await response.text()).toBe(buildMtaStsPolicy());
	});

	it("answers HEAD without a body, as senders may probe before fetching", () => {
		const response = mtaStsResponse(new Request(policyUrl, { method: "HEAD" }));

		expect(response.status).toBe(200);
		expect(response.body).toBeNull();
	});

	it.each([
		"/",
		"/about",
		"/sitemap.xml",
		"/llms.txt",
		"/.well-known/mta-sts.txt/",
	])("404s %s rather than serving a second copy of the site", (pathname) => {
		const response = mtaStsResponse(new Request(`https://mta-sts.auditmos.com${pathname}`));

		expect(response.status).toBe(404);
	});

	it("never redirects — RFC 8461 senders must not follow redirects", () => {
		for (const pathname of ["/", "/about", MTA_STS_POLICY_PATH]) {
			const response = mtaStsResponse(new Request(`https://mta-sts.auditmos.com${pathname}`));
			const isRedirect = response.status >= 300 && response.status < 400;

			expect({ pathname, isRedirect }).toEqual({ pathname, isRedirect: false });
			expect(response.headers.get("location")).toBeNull();
		}
	});

	it("rejects writes to the policy path", () => {
		const response = mtaStsResponse(new Request(policyUrl, { method: "POST" }));

		expect(response.status).toBe(405);
		expect(response.headers.get("allow")).toBe("GET, HEAD");
	});
});
