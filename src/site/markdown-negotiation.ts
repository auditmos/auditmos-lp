/**
 * `Accept: text/markdown` content negotiation for the prerendered pages.
 *
 * Every page already ships a curated markdown twin (`/` → `/index.md`,
 * `/about` → `/about.md`). This serves that same document from the HTML URL
 * when a client asks for markdown, so an agent gets it without knowing the
 * `.md` naming convention — HTML stays the default for every other client.
 *
 * The Worker only sees page requests at all because `assets.run_worker_first`
 * in `wrangler.jsonc` lists the page routes; without that the asset server
 * answers them and none of this runs. A build-output test asserts the list
 * covers every prerendered page route.
 */

/** The slice of Cloudflare's `Fetcher` this module needs from the `ASSETS` binding. */
export interface AssetFetcher {
	fetch(request: Request): Promise<Response>;
}

const markdownMediaType = "text/markdown";
const htmlMediaType = "text/html";

// Headers that describe the `.md` asset's own body rather than the
// representation served here: a conditional request replaying them against the
// HTML URL would be validated against the wrong document. Cloudflare's own
// Markdown for Agents conversion drops the same set.
const bodyBoundHeaders = ["ETag", "Last-Modified", "Content-Encoding", "Content-Length"] as const;

// Request-time routes. They have no extension, so the page-route test below
// would otherwise send them looking for a markdown twin.
const requestTimeRoutes = new Set(["/mcp"]);

/** Maps `Accept` media ranges to their q-value, lowercased, last one winning. */
function acceptedQualities(header: string): Map<string, number> {
	const qualities = new Map<string, number>();

	for (const entry of header.split(",")) {
		const [rawType, ...parameters] = entry.split(";");
		const mediaType = rawType?.trim().toLowerCase();
		if (!mediaType) continue;

		const quality = parameters
			.map((parameter) => parameter.trim().toLowerCase())
			.find((parameter) => parameter.startsWith("q="))
			?.slice(2);
		const parsed = quality === undefined ? 1 : Number.parseFloat(quality);

		qualities.set(mediaType, Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 1);
	}

	return qualities;
}

/** Best q-value offered for `mediaType`, including via a group or catch-all range. */
function qualityOf(qualities: Map<string, number>, mediaType: string): number {
	const group = `${mediaType.slice(0, mediaType.indexOf("/"))}/*`;

	return qualities.get(mediaType) ?? qualities.get(group) ?? qualities.get("*/*") ?? 0;
}

function prefersMarkdown(accept: string | null): boolean {
	if (!accept) return false;

	const qualities = acceptedQualities(accept);
	// Only a literal `text/markdown` counts as asking for markdown. A browser
	// sends `text/html,…,*/*;q=0.8`, and that trailing wildcard matches every
	// media type — honouring it would hand markdown to every browser.
	const markdown = qualities.get(markdownMediaType) ?? 0;

	return markdown > 0 && markdown >= qualityOf(qualities, htmlMediaType);
}

/**
 * The markdown twin of a page route, or `null` when the path is not a page:
 * an extension means a concrete asset (`/about.md`, `/og.png`), and the
 * request-time endpoints render no document to convert.
 */
function markdownTwinPath(pathname: string): string | null {
	const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

	if (path === "/") return "/index.md";
	if (!path.startsWith("/")) return null;
	if (path.startsWith("/api/") || path.startsWith("/_")) return null;
	if (requestTimeRoutes.has(path)) return null;

	const lastSegment = path.slice(path.lastIndexOf("/") + 1);
	if (!lastSegment || lastSegment.includes(".")) return null;

	return `${path}.md`;
}

// ~4 characters per token is the standard rough estimate for English prose. The
// header is advisory — agents use it to budget context — so an estimate is
// worth more than the bytes a real tokenizer would add to the Worker.
function estimateTokens(markdown: string): number {
	return Math.ceil(markdown.length / 4);
}

/** Adds `Accept` to `Vary` without dropping dimensions the response already declared. */
function varyOnAccept(headers: Headers): void {
	const declared = (headers.get("Vary") ?? "")
		.split(",")
		.map((dimension) => dimension.trim())
		.filter(Boolean);

	if (declared.some((dimension) => dimension === "*" || dimension.toLowerCase() === "accept")) {
		return;
	}

	headers.set("Vary", [...declared, "Accept"].join(", "));
}

/** Responses handed back by `fetch` have immutable headers, so re-wrap to edit them. */
function negotiable(response: Response): Response {
	const negotiated = new Response(response.body, response);
	varyOnAccept(negotiated.headers);

	return negotiated;
}

async function markdownTwinResponse(
	request: Request,
	assets: AssetFetcher,
	twinPath: string,
): Promise<Response | null> {
	// A bare GET rather than a copy of the incoming request: a conditional
	// header would earn a bodiless 304 and there would be nothing to count.
	const asset = await assets.fetch(new Request(new URL(twinPath, request.url), { method: "GET" }));
	if (!asset.ok) return null;

	const markdown = await asset.text();
	const headers = new Headers(asset.headers);

	for (const header of bodyBoundHeaders) headers.delete(header);
	headers.set("Content-Type", `${markdownMediaType}; charset=utf-8`);
	headers.set("X-Markdown-Tokens", String(estimateTokens(markdown)));
	varyOnAccept(headers);

	return new Response(request.method === "HEAD" ? null : markdown, { status: 200, headers });
}

/**
 * Answers page requests that ask for markdown from the page's markdown twin,
 * and delegates everything else — every other route, every other method, and
 * any page whose twin is missing — to `next`.
 */
export async function withMarkdownNegotiation(
	request: Request,
	assets: AssetFetcher,
	next: () => Promise<Response>,
): Promise<Response> {
	const twinPath = markdownTwinPath(new URL(request.url).pathname);
	const readOnly = request.method === "GET" || request.method === "HEAD";

	if (!twinPath || !readOnly) return next();
	if (!prefersMarkdown(request.headers.get("Accept"))) return negotiable(await next());

	return (await markdownTwinResponse(request, assets, twinPath)) ?? negotiable(await next());
}
