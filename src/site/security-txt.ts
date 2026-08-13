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
