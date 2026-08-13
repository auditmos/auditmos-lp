/**
 * The RFC 9116 security.txt — where to report a vulnerability in this site.
 *
 * The document exists to answer one question a researcher has at the moment
 * they find something: who do I tell, and will anyone read it. Without it the
 * honest options are a contact form that looks like a sales funnel, or nothing.
 *
 * **`Expires` is computed from the build, not checked in.** RFC 9116 §2.5.5
 * says a researcher should not rely on an expired file, so a hardcoded date
 * degrades into "do not contact us" on a day nobody is watching. Deriving it
 * from build time means every deploy renews it, and a site left undeployed past
 * the window says so truthfully rather than by neglect — which is the honest
 * reading of a stale file anyway.
 */

import { site } from "@/brand/site";

/** RFC 9116 §3 reserves this exact path. */
export const SECURITY_TXT_PATH = "/.well-known/security.txt";

/**
 * How long a published file stays valid. Under the RFC's one-year ceiling, and
 * comfortably longer than this site's deploy cadence, so routine work renews it
 * without anyone thinking about it.
 */
export const SECURITY_TXT_VALIDITY_DAYS = 365;

const MS_PER_DAY = 86_400_000;

/**
 * The `Expires` timestamp for a file built at `builtAt`.
 *
 * Truncated to the second: RFC 9116 wants an RFC 3339 timestamp, and
 * milliseconds in a field whose resolution is "sometime next year" only make
 * two builds look meaningfully different when they are not.
 */
export function securityTxtExpiry(builtAt: Date): string {
	const expires = new Date(builtAt.getTime() + SECURITY_TXT_VALIDITY_DAYS * MS_PER_DAY);

	return `${expires.toISOString().slice(0, 19)}Z`;
}

/**
 * The file, as served.
 *
 * `Canonical` names the production URL only, even in the copy staging serves.
 * That is deliberate and is what §2.5.2 is for: a researcher who finds this
 * file on any other host can see it is not the authoritative one. Listing
 * staging here would publish a second address that answers for the same
 * document, and invite a report about a host that is not the product.
 */
/**
 * How close to expiry the served file may drift before it is worth saying so.
 *
 * Not a failure: `Expires` is derived from the build, so any deploy renews it.
 * It is a countdown on how long production has gone untouched, and the point of
 * surfacing it is that the file stops being usable *silently* — nothing errors,
 * a researcher simply reads "do not rely on this" and moves on.
 */
const SECURITY_TXT_RENEWAL_DAYS = 30;

interface SecurityTxtFields {
	contacts: string[];
	/** Every `Expires` seen. More than one makes the file invalid (§2.5.5). */
	expires: string[];
	canonical: string[];
}

/** What a deployed host answered with, as the checks need to see it. */
export interface ServedSecurityTxt {
	url: string;
	status: number;
	contentType: string | null;
	body: string;
	now: Date;
}

export interface SecurityTxtProblem {
	/** `renew` is advisory; anything else is a regression. */
	severity: "fail" | "renew";
	reason: string;
}

/** Field values by name, comments and blank lines discarded. */
function parseSecurityTxt(text: string): SecurityTxtFields {
	const collect = (name: string): string[] =>
		text
			.split(/\r?\n/)
			.filter((line) => line.toLowerCase().startsWith(`${name.toLowerCase()}:`))
			.map((line) => line.slice(name.length + 1).trim());

	return {
		contacts: collect("Contact"),
		expires: collect("Expires"),
		canonical: collect("Canonical"),
	};
}

/**
 * Everything wrong with a served security.txt, worst first.
 *
 * `Canonical` is only enforced when the host being checked is the one the file
 * names — staging serves production's canonical on purpose (§2.5.2), so
 * demanding a match there would fail a correct file.
 */
export function verifySecurityTxt(served: ServedSecurityTxt): SecurityTxtProblem[] {
	const problems: SecurityTxtProblem[] = [];

	if (served.status !== 200) {
		return [{ severity: "fail", reason: `answered ${served.status}, expected 200` }];
	}

	if (!(served.contentType ?? "").startsWith("text/plain")) {
		problems.push({
			severity: "fail",
			reason: `served as "${served.contentType ?? "no content-type"}", expected text/plain`,
		});
	}

	const fields = parseSecurityTxt(served.body);

	if (fields.contacts.length === 0) {
		problems.push({ severity: "fail", reason: "no Contact field — the file's only required job" });
	}

	if (fields.expires.length !== 1) {
		problems.push({
			severity: "fail",
			reason: `${fields.expires.length} Expires fields, RFC 9116 allows exactly one`,
		});

		return problems;
	}

	const expires = new Date(fields.expires[0] as string);

	if (Number.isNaN(expires.getTime())) {
		problems.push({
			severity: "fail",
			reason: `Expires "${fields.expires[0]}" is not a timestamp`,
		});

		return problems;
	}

	const daysLeft = (expires.getTime() - served.now.getTime()) / MS_PER_DAY;

	if (daysLeft <= 0) {
		problems.push({
			severity: "fail",
			reason: `expired ${Math.abs(Math.round(daysLeft))} days ago — researchers are told not to rely on it`,
		});
	} else if (daysLeft < SECURITY_TXT_RENEWAL_DAYS) {
		problems.push({
			severity: "renew",
			reason: `expires in ${Math.round(daysLeft)} days; any deploy renews it`,
		});
	}

	const servedOrigin = new URL(served.url).origin;
	const claimsThisHost = fields.canonical.some((uri) => {
		try {
			return new URL(uri).origin === servedOrigin;
		} catch {
			return false;
		}
	});

	if (claimsThisHost && !fields.canonical.includes(served.url)) {
		problems.push({
			severity: "fail",
			reason: `Canonical names this origin but not ${served.url}`,
		});
	}

	return problems;
}

export function buildSecurityTxt(builtAt: Date): string {
	return [
		"# Security contact for Auditmos OÜ.",
		"#",
		"# Reports about auditmos.com and its subdomains are welcome, including",
		"# findings that need no proof-of-concept exploit to explain. Please do not",
		"# run automated scans that degrade the service for anyone else.",
		"",
		`Contact: mailto:${site.contactEmail}`,
		`Contact: ${site.url}/contact`,
		`Expires: ${securityTxtExpiry(builtAt)}`,
		"Preferred-Languages: en, pl",
		`Canonical: ${site.url}${SECURITY_TXT_PATH}`,
		"",
	].join("\n");
}
