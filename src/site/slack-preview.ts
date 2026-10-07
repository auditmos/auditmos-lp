/** Slack's thumbnail variant, applied after fetching the unchanged static HTML. */
// First 12 hex of the PNG's SHA-256; pinned against its HTTP bytes by the test.
const slackImageUrl = "https://auditmos.com/og-slack.png?v=ad84e0cde768";

function isSlack(request: Request): boolean {
	return /(?:^|[\s(])Slackbot-LinkExpanding(?=[\s/;)]|$)/i.test(
		request.headers.get("User-Agent") ?? "",
	);
}

/**
 * Cloudflare does not key its cache on arbitrary Vary values. Do not cache
 * either final HTML variant: otherwise a cached ordinary response could bypass
 * Slack detection too. The ASSETS binding still caches the original static
 * file; rewritten output is never passed to fetch() or caches.put().
 * https://developers.cloudflare.com/cache/concepts/cache-control/
 */
function preventVariantCaching(response: Response): Response {
	const result = new Response(response.body, response);
	for (const header of ["Cache-Control", "CDN-Cache-Control", "Cloudflare-CDN-Cache-Control"]) {
		result.headers.set(header, "no-store");
	}
	const vary = (result.headers.get("Vary") ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
	if (!vary.some((part) => part === "*" || part.toLowerCase() === "user-agent")) {
		result.headers.set("Vary", [...vary, "User-Agent"].join(", "));
	}
	return result;
}

/** Streams just the image meta changes; titles, canonical, scripts and body survive verbatim. */
export async function withSlackPreview(
	request: Request,
	next: (request: Request) => Promise<Response>,
): Promise<Response> {
	if (request.method !== "GET" && request.method !== "HEAD") return next(request);
	const slack = isSlack(request);
	let upstream = request;
	if (slack) {
		upstream = new Request(request);
		// Validators and byte ranges describe the unmodified asset, not Slack's
		// representation. A 304 or partial response would skip the head rewrite.
		for (const header of ["If-None-Match", "If-Modified-Since", "Range", "If-Range"]) {
			upstream.headers.delete(header);
		}
	}
	const response = await next(upstream);
	const html =
		response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() === "text/html";
	// A 304 may omit Content-Type; it still must not refresh a cache entry
	// without the variant's cache policy. No changes to JSON, markdown or images.
	if (!html && response.status !== 304) return response;
	const result = preventVariantCaching(response);
	if (!slack || !html || response.status !== 200) return result;
	for (const header of [
		"ETag",
		"Last-Modified",
		"Content-Length",
		"Content-Range",
		"Accept-Ranges",
	]) {
		result.headers.delete(header);
	}
	if (request.method === "HEAD") return result;
	let twitterImageSeen = false;
	return new HTMLRewriter()
		.on('head meta[property="og:image"]', {
			element: (element) => {
				element.setAttribute("content", slackImageUrl);
			},
		})
		.on('head meta[property="og:image:width"], head meta[property="og:image:height"]', {
			element: (element) => {
				element.setAttribute("content", "800");
			},
		})
		.on('head meta[name="twitter:image"], head meta[property="twitter:image"]', {
			element: (element) => {
				twitterImageSeen = true;
				element.setAttribute("content", slackImageUrl);
			},
		})
		.on("head", {
			element: (element) => {
				element.onEndTag((end) => {
					// The current layout relies on OG fallback and has no twitter:image.
					// Insert it only for Slack, without changing the shared layout.
					if (!twitterImageSeen)
						end.before(`<meta name="twitter:image" content="${slackImageUrl}">`, { html: true });
				});
			},
		})
		.transform(result);
}
