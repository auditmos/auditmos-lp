/**
 * TDD assumptions for the RFC 9116 contact:
 * - `Expires` is derived from build time, so the assertions are about the window
 *   it produces, never about a literal date.
 * - A parser reads this file, so field syntax is the contract — one `Expires`,
 *   URIs on every `Contact`, and a `Canonical` that names production only.
 */

import { site } from "@/brand/site";
import {
	buildSecurityTxt,
	SECURITY_TXT_PATH,
	SECURITY_TXT_VALIDITY_DAYS,
	securityTxtExpiry,
	verifySecurityTxt,
} from "./security-txt";

const builtAt = new Date("2026-08-13T09:30:45.123Z");
const fields = (policy: string, name: string): string[] =>
	policy
		.split("\n")
		.filter((line) => line.startsWith(`${name}:`))
		.map((line) => line.slice(name.length + 1).trim());

describe("securityTxtExpiry", () => {
	it("is an RFC 3339 timestamp, seconds resolution, in UTC", () => {
		expect(securityTxtExpiry(builtAt)).toBe("2027-08-13T09:30:45Z");
	});

	it("stays inside the RFC's one-year ceiling", () => {
		const expires = new Date(securityTxtExpiry(builtAt));
		const days = (expires.getTime() - builtAt.getTime()) / 86_400_000;

		// Never *more* than the configured window: truncating to whole seconds can
		// only round the expiry down, which errs toward renewing sooner.
		expect(days).toBeLessThanOrEqual(SECURITY_TXT_VALIDITY_DAYS);
		expect(days).toBeGreaterThan(SECURITY_TXT_VALIDITY_DAYS - 1 / 86_400);
		expect(days).toBeLessThanOrEqual(366);
	});
});

describe("buildSecurityTxt", () => {
	const policy = buildSecurityTxt(builtAt);

	it("publishes exactly one Expires — more than one makes the file invalid", () => {
		expect(fields(policy, "Expires")).toEqual(["2027-08-13T09:30:45Z"]);
	});

	it("gives every Contact as a URI, not a bare address", () => {
		const contacts = fields(policy, "Contact");

		expect(contacts).toEqual([`mailto:${site.contactEmail}`, `${site.url}/contact`]);
		for (const contact of contacts) {
			expect(() => new URL(contact)).not.toThrow();
		}
	});

	it("names production as the canonical location, even in staging's copy", () => {
		// §2.5.2: a file found somewhere its Canonical does not name is not the
		// authoritative one. Staging serving production's URL is the point.
		expect(fields(policy, "Canonical")).toEqual([`https://auditmos.com${SECURITY_TXT_PATH}`]);
	});

	it("declares the languages a report will actually be read in", () => {
		expect(fields(policy, "Preferred-Languages")).toEqual(["en, pl"]);
	});

	it("keeps prose in comments so a parser sees only fields", () => {
		const lines = policy.split("\n").filter((line) => line.trim() !== "");

		for (const line of lines) {
			expect(line.startsWith("#") || /^[A-Za-z-]+: \S/.test(line)).toBe(true);
		}
	});

	it("renews with the build rather than counting down from a fixed date", () => {
		const later = buildSecurityTxt(new Date(builtAt.getTime() + 86_400_000));

		expect(fields(later, "Expires")).toEqual(["2027-08-14T09:30:45Z"]);
	});
});

describe("verifySecurityTxt", () => {
	const served = (overrides: Partial<Parameters<typeof verifySecurityTxt>[0]> = {}) =>
		verifySecurityTxt({
			url: `https://auditmos.com${SECURITY_TXT_PATH}`,
			status: 200,
			contentType: "text/plain; charset=utf-8",
			body: buildSecurityTxt(builtAt),
			now: builtAt,
			...overrides,
		});

	it("passes what the build actually produces", () => {
		expect(served()).toEqual([]);
	});

	it.each([
		[404, "answered 404"],
		[500, "answered 500"],
	])("fails a %s and reports nothing else about a file it never got", (status, reason) => {
		const problems = served({ status });

		expect(problems).toHaveLength(1);
		expect(problems[0]?.reason).toContain(reason);
	});

	it("fails a file served as HTML — parsers will not read it", () => {
		expect(served({ contentType: "text/html" })[0]).toMatchObject({ severity: "fail" });
	});

	it("fails when Expires has passed, which is the silent failure mode", () => {
		const problems = served({ now: new Date("2027-09-01T00:00:00Z") });

		expect(problems[0]?.severity).toBe("fail");
		expect(problems[0]?.reason).toContain("expired");
	});

	it("advises renewal without failing as expiry approaches", () => {
		const problems = served({ now: new Date("2027-08-01T09:30:45Z") });

		expect(problems).toEqual([
			{ severity: "renew", reason: "expires in 12 days; any deploy renews it" },
		]);
	});

	it("fails a second Expires rather than guessing which one is meant", () => {
		const problems = served({
			body: `${buildSecurityTxt(builtAt)}Expires: 2030-01-01T00:00:00Z\n`,
		});

		expect(problems[0]?.reason).toContain("2 Expires fields");
	});

	it("fails a file with no Contact", () => {
		const problems = served({ body: "Expires: 2027-08-13T09:30:45Z\n" });

		expect(problems.some((p) => p.reason.includes("no Contact"))).toBe(true);
	});

	it("does not hold staging to production's Canonical", () => {
		// Staging serves production's canonical by design — that is how a reader
		// tells the copy from the original.
		expect(served({ url: `https://staging.auditmos.com${SECURITY_TXT_PATH}` })).toEqual([]);
	});

	it("fails when Canonical names this origin but a different path", () => {
		const problems = served({
			body: buildSecurityTxt(builtAt).replace(SECURITY_TXT_PATH, "/security.txt"),
		});

		expect(problems[0]?.reason).toContain("Canonical names this origin");
	});
});
