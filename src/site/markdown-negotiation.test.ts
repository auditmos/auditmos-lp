import { type AssetFetcher, withMarkdownNegotiation } from "./markdown-negotiation";

const twinBody = "# About Auditmos\n\nAuditmos is a small, independent technical company.\n";

// Stands in for the `ASSETS` binding: serves the markdown twins the build
// prerenders, 404s for anything else, and records what it was asked for.
function assetsServing(twins: Record<string, string>): AssetFetcher & { requested: string[] } {
	const requested: string[] = [];

	return {
		requested,
		fetch(request: Request) {
			const { pathname } = new URL(request.url);
			requested.push(pathname);
			const body = twins[pathname];

			if (body === undefined) {
				return Promise.resolve(new Response("Not found", { status: 404 }));
			}

			return Promise.resolve(
				new Response(body, {
					status: 200,
					headers: {
						"Content-Type": "text/markdown; charset=utf-8",
						"Cache-Control": "public, max-age=3600",
						ETag: '"md-twin"',
						"Last-Modified": "Wed, 11 Feb 2026 11:44:48 GMT",
						Link: '</llms.txt>; rel="service-desc"',
					},
				}),
			);
		},
	};
}

const siteAssets = () => assetsServing({ "/about.md": twinBody, "/index.md": "# Auditmos\n" });

function htmlResponse(): Response {
	return new Response("<!doctype html><title>About</title>", {
		status: 200,
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

function negotiate(
	url: string,
	init: RequestInit = {},
	assets: AssetFetcher = siteAssets(),
	next: () => Promise<Response> = () => Promise.resolve(htmlResponse()),
): Promise<Response> {
	return withMarkdownNegotiation(new Request(url, init), assets, next);
}

const markdownRequest = { headers: { Accept: "text/markdown" } } satisfies RequestInit;
const browserAccept =
	"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

describe("withMarkdownNegotiation", () => {
	describe("when a page request asks for markdown", () => {
		it("answers with the page's markdown twin", async () => {
			const response = await negotiate("https://auditmos.com/about", markdownRequest);

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
			expect(await response.text()).toBe(twinBody);
		});

		it("maps the site root to /index.md", async () => {
			const assets = siteAssets();
			await negotiate("https://auditmos.com/", markdownRequest, assets);

			expect(assets.requested).toEqual(["/index.md"]);
		});

		// Belt and braces: in the deployed Worker `canonicalRedirect` 301s the
		// slash form before this layer sees it, so production never reaches here.
		it("resolves the trailing-slash form of a page to the same twin", async () => {
			const assets = siteAssets();
			await negotiate("https://auditmos.com/about/", markdownRequest, assets);

			expect(assets.requested).toEqual(["/about.md"]);
		});

		it("publishes an estimated token count for the markdown body", async () => {
			const response = await negotiate("https://auditmos.com/about", markdownRequest);

			expect(response.headers.get("X-Markdown-Tokens")).toBe(
				String(Math.ceil(twinBody.length / 4)),
			);
		});

		it("varies on Accept so a cache never serves markdown to a browser", async () => {
			const response = await negotiate("https://auditmos.com/about", markdownRequest);

			expect(response.headers.get("Vary")).toBe("Accept");
		});

		it("keeps the twin's cache and discovery headers", async () => {
			const response = await negotiate("https://auditmos.com/about", markdownRequest);

			expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
			expect(response.headers.get("Link")).toBe('</llms.txt>; rel="service-desc"');
		});

		it("drops validators that describe the .md asset rather than this URL", async () => {
			const response = await negotiate("https://auditmos.com/about", markdownRequest);

			expect(response.headers.get("ETag")).toBeNull();
			expect(response.headers.get("Last-Modified")).toBeNull();
		});

		it("answers HEAD with the headers and no body", async () => {
			const response = await negotiate("https://auditmos.com/about", {
				method: "HEAD",
				headers: { Accept: "text/markdown" },
			});

			expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
			expect(response.headers.get("X-Markdown-Tokens")).toBe(
				String(Math.ceil(twinBody.length / 4)),
			);
			expect(await response.text()).toBe("");
		});

		it.each([
			["a bare markdown request", "text/markdown"],
			["markdown ranked above HTML", "text/markdown,text/html;q=0.9"],
			["markdown tied with HTML", "text/markdown, text/html"],
			["markdown with parameters", "text/markdown; charset=utf-8"],
			["an uppercased media type", "TEXT/MARKDOWN"],
			["markdown after an unsupported type", "application/yaml, text/markdown"],
		])("treats %s as a markdown request", async (_case, accept) => {
			const response = await negotiate("https://auditmos.com/about", {
				headers: { Accept: accept },
			});

			expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
		});
	});

	describe("when the client has not asked for markdown", () => {
		it.each([
			["a browser", browserAccept],
			["a wildcard-only client", "*/*"],
			["a client preferring HTML", "text/html, text/markdown;q=0.5"],
			["a client refusing markdown", "text/html, text/markdown;q=0"],
			["a JSON client", "application/json"],
		])("serves HTML to %s", async (_case, accept) => {
			const response = await negotiate("https://auditmos.com/about", {
				headers: { Accept: accept },
			});

			expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		});

		it("serves HTML when no Accept header is sent at all", async () => {
			const response = await negotiate("https://auditmos.com/about");

			expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		});

		it("never reads a markdown twin it is not going to serve", async () => {
			const assets = siteAssets();
			await negotiate("https://auditmos.com/about", { headers: { Accept: browserAccept } }, assets);

			expect(assets.requested).toEqual([]);
		});

		it("still varies the HTML on Accept, since the same URL has two representations", async () => {
			const response = await negotiate("https://auditmos.com/about", {
				headers: { Accept: browserAccept },
			});

			expect(response.headers.get("Vary")).toBe("Accept");
		});

		it("adds Accept to a Vary the response already declared", async () => {
			const response = await negotiate(
				"https://auditmos.com/about",
				{ headers: { Accept: browserAccept } },
				siteAssets(),
				() =>
					Promise.resolve(
						new Response("<!doctype html>", { headers: { Vary: "Accept-Encoding" } }),
					),
			);

			expect(response.headers.get("Vary")).toBe("Accept-Encoding, Accept");
		});
	});

	describe("when the route is not a prerendered page", () => {
		it.each([
			["the markdown twin itself", "https://auditmos.com/about.md"],
			["a static asset", "https://auditmos.com/og.png"],
			["the contact endpoint", "https://auditmos.com/api/contact"],
			["the MCP endpoint", "https://auditmos.com/mcp"],
			["an Astro internal route", "https://auditmos.com/_server-islands/name"],
		])("passes %s straight through", async (_case, url) => {
			const assets = siteAssets();
			const response = await negotiate(url, markdownRequest, assets);

			expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
			expect(response.headers.get("Vary")).toBeNull();
			expect(assets.requested).toEqual([]);
		});

		it.each(["POST", "PUT", "DELETE"])("passes a %s to a page route through", async (method) => {
			const assets = siteAssets();
			const response = await negotiate("https://auditmos.com/about", {
				method,
				...markdownRequest,
			});

			expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
			expect(assets.requested).toEqual([]);
		});

		it("falls back to HTML when a page has no markdown twin", async () => {
			const response = await negotiate("https://auditmos.com/not-a-page", markdownRequest);

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		});
	});
});
