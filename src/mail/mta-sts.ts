/**
 * The MTA-STS policy (RFC 8461) served at
 * `https://mta-sts.auditmos.com/.well-known/mta-sts.txt`.
 *
 * MTA-STS closes the hole STARTTLS leaves open: STARTTLS is opportunistic, so a
 * sending MTA that cannot negotiate encryption delivers in the clear instead,
 * and an active attacker can force exactly that by stripping the `STARTTLS`
 * advertisement out of the `EHLO` response. A published policy tells senders
 * that encryption is not optional for this domain, and which MX hosts to expect.
 * DANE would be the alternative, but Google Workspace publishes no TLSA records
 * for its MX hosts, so this is the only route available.
 *
 * **`mode: enforce` with a wrong MX list blocks inbound mail.** That is the
 * whole risk here, and it is why `MX_HOSTS` below is a checked-in constant with
 * a test asserting the policy reproduces it exactly, rather than a list built at
 * request time from something that could be empty or stale. It is also why the
 * policy ships in `testing` first: senders report failures via TLS-RPT (#33) and
 * still deliver, so a mistake is visible before it is fatal.
 *
 * This module is shared by two consumers on purpose: the standalone Worker in
 * `workers/mta-sts/` that serves the file, and the tests that pin its contents.
 * A policy file written out by hand somewhere else would be a second source of
 * truth for a list whose accuracy inbound mail depends on.
 */

/** Where every sender fetches the policy. The path is fixed by RFC 8461 §3.3. */
export const MTA_STS_POLICY_PATH = "/.well-known/mta-sts.txt";

/**
 * The five Google Workspace MX hosts, in priority order.
 *
 * Must match the zone's live MX records exactly. `pnpm mta-sts:verify` compares
 * the two against DNS, because nothing in a build can: the MX records live in
 * Cloudflare DNS and change without this repo being touched.
 */
export const MX_HOSTS = [
	"aspmx.l.google.com",
	"alt1.aspmx.l.google.com",
	"alt2.aspmx.l.google.com",
	"alt3.aspmx.l.google.com",
	"alt4.aspmx.l.google.com",
] as const;

/**
 * `testing` until TLS-RPT has been quiet for a week, then `enforce` (#34).
 *
 * Changing this **must** be paired with a new `id` in the `_mta-sts` TXT record
 * — that is the only signal senders have to re-fetch a policy they have cached
 * for `max_age`. Change the mode alone and senders keep enforcing the old one.
 */
export const MTA_STS_MODE = "testing";

/** Seven days. Long enough to be useful, short enough to back out of. */
export const MTA_STS_MAX_AGE = 604800;

/**
 * The policy file, byte for byte.
 *
 * CRLF line endings: RFC 8461 §3.2 defines the format in terms of CRLF, and
 * while most parsers tolerate LF, the one that does not would fail closed on a
 * domain whose mail it is refusing to downgrade.
 */
export function buildMtaStsPolicy(): string {
	return [
		"version: STSv1",
		`mode: ${MTA_STS_MODE}`,
		...MX_HOSTS.map((host) => `mx: ${host}`),
		`max_age: ${MTA_STS_MAX_AGE}`,
		"",
	].join("\r\n");
}

/** The `mx:` entries a served policy declares, in the order it declares them. */
export function parsePolicyMxHosts(policy: string): string[] {
	return policy
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.startsWith("mx:"))
		.map((line) => line.slice("mx:".length).trim().toLowerCase());
}

export interface MxComparison {
	matches: boolean;
	/** In DNS, absent from the policy — senders would reject a valid MX. */
	missingFromPolicy: string[];
	/** In the policy, absent from DNS — a stale host the policy still blesses. */
	unexpectedInPolicy: string[];
}

/**
 * The policy's MX list against the zone's live one.
 *
 * Order is deliberately not compared: RFC 8461 gives `mx:` entries no
 * precedence, and MX priority is DNS's business. Membership is what decides
 * whether mail is delivered or refused under `enforce`.
 */
export function compareMx(
	policyHosts: readonly string[],
	dnsHosts: readonly string[],
): MxComparison {
	const inPolicy = new Set(policyHosts.map((host) => host.toLowerCase()));
	const inDns = new Set(dnsHosts.map((host) => host.replace(/\.$/, "").toLowerCase()));
	const missingFromPolicy = [...inDns].filter((host) => !inPolicy.has(host)).sort();
	const unexpectedInPolicy = [...inPolicy].filter((host) => !inDns.has(host)).sort();

	return {
		matches: missingFromPolicy.length === 0 && unexpectedInPolicy.length === 0,
		missingFromPolicy,
		unexpectedInPolicy,
	};
}

/**
 * The response for a request to the MTA-STS host: the policy, or nothing.
 *
 * Everything but the policy path is a 404 rather than a redirect to the main
 * site. A hostname that answers for the whole site would be a second URL for
 * every document — the duplicate-URL problem this repo already fixed once for
 * trailing slashes (#38) — and RFC 8461 §3.3 requires senders *not* to follow
 * redirects when fetching the policy, so a redirect here is never useful.
 */
export function mtaStsResponse(request: Request): Response {
	const { pathname } = new URL(request.url);

	if (pathname !== MTA_STS_POLICY_PATH) {
		return new Response("Not found\n", {
			status: 404,
			headers: { "content-type": "text/plain; charset=utf-8" },
		});
	}

	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response("Method not allowed\n", {
			status: 405,
			headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
		});
	}

	return new Response(request.method === "HEAD" ? null : buildMtaStsPolicy(), {
		status: 200,
		headers: {
			"content-type": "text/plain; charset=utf-8",
			// A day. Senders cache by `max_age` anyway; this only bounds how long a
			// corrected policy takes to reach one that is re-fetching after an `id`
			// change, which is the moment the freshness actually matters.
			"cache-control": "public, max-age=86400",
		},
	});
}
