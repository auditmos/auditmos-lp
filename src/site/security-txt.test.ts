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
