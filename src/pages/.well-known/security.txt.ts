import { buildSecurityTxt } from "@/site/security-txt";

export const prerender = true;

/**
 * The RFC 9116 vulnerability-disclosure contact.
 *
 * `new Date()` runs at build time, which is the point: `Expires` is renewed by
 * every deploy rather than counting down from a date somebody typed once.
 *
 * The `.txt` extension carries the media type through the build, so unlike
 * `/.well-known/api-catalog` this one needs no `_headers` entry to be served as
 * `text/plain`.
 */
export function GET(): Response {
	return new Response(buildSecurityTxt(new Date()), {
		status: 200,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			// Same rationale as the other well-known documents: public, read-only
			// discovery metadata that browser-based agents read cross-origin.
			"Access-Control-Allow-Origin": "*",
		},
	});
}
