import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execa } from "execa";
import { AI_CATALOG_PATH, SERVER_CARD_PATHS } from "@/mcp/server-card";
import { CONTENT_SIGNAL } from "./discovery-headers";
import { staticPages } from "./pages";

const root = resolve(import.meta.dirname, "..", "..");
const distClient = resolve(root, "dist", "client");
// 52 KB: the original 50 KB budget plus ~2 KB of CSS for the self-hosted brand
// typefaces (Space Grotesk + IBM Plex Mono @font-face) and texture utilities.
const maxTransferredBytes = 52 * 1024;
const sampleProjectRoutes = [
	"/projects/auditmos-website-rebuild",
	"/projects/regulated-platform-security-review",
] as const;
const prerenderedRoutes = [
	...staticPages.map((page) => page.path),
	...sampleProjectRoutes,
] as const;
const clientJavaScriptRoutes = new Set<string>(["/contact"]);

function htmlPathFor(route: string): string {
	const path = route === "/" ? "index" : route.slice(1);
	const candidates = [resolve(distClient, `${path}.html`), resolve(distClient, path, "index.html")];
	const match = candidates.find((candidate) => existsSync(candidate));

	if (!match) {
		throw new Error(`No prerendered HTML found for ${route}`);
	}

	return match;
}

function cssFilesFor(html: string): string[] {
	return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)].map((match) =>
		resolve(distClient, match[1].replace(/^\//, "")),
	);
}

function pageTransferSize(htmlFile: string): number {
	const html = readFileSync(htmlFile, "utf8");
	const cssBytes = cssFilesFor(html).reduce(
		(total, cssFile) => total + (existsSync(cssFile) ? statSync(cssFile).size : 0),
		0,
	);

	return statSync(htmlFile).size + cssBytes;
}

function generatedSitemapSource(): string {
	const sitemapFiles = readdirSync(distClient).filter((file) => file.includes("sitemap"));
	return sitemapFiles.map((file) => readFileSync(join(distClient, file), "utf8")).join("\n");
}

function workerEntrySource(): string {
	const entryFile = resolve(root, "dist", "server", "entry.mjs");

	if (!existsSync(entryFile)) {
		throw new Error("No Cloudflare worker entry found in build output");
	}

	return readFileSync(entryFile, "utf8");
}

// Extracts the JSON object literal that starts at or after `fromIndex`,
// brace-matching while skipping over string literals so serialized values
// containing braces don't throw off the depth count.
function extractJsonObject(source: string, fromIndex: number): string {
	const objectStart = source.indexOf("{", fromIndex);

	if (objectStart === -1) {
		throw new Error("No serialized Astro manifest object found in worker entry");
	}

	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let i = objectStart; i < source.length; i++) {
		const char = source[i];

		if (escaped) escaped = false;
		else if (char === "\\") escaped = true;
		else if (char === '"') inString = !inString;
		else if (inString) continue;
		else if (char === "{") depth++;
		else if (char === "}" && --depth === 0) return source.slice(objectStart, i + 1);
	}

	throw new Error("Unterminated serialized Astro manifest object in worker entry");
}

function astroBuildPageRoutePatterns(): string[] {
	const source = workerEntrySource();
	// Astro emits `var _manifest = deserializeManifest({...})` in the SSR entry;
	// match on the assignment so a `const`/`var` change doesn't break parsing.
	const marker = "_manifest = deserializeManifest(";
	const start = source.indexOf(marker);

	if (start === -1) {
		throw new Error("No serialized Astro manifest found in worker entry");
	}

	const manifest = JSON.parse(extractJsonObject(source, start + marker.length)) as {
		routes: {
			routeData: {
				origin: string;
				params: string[];
				prerender: boolean;
				route: string;
				type: string;
			};
		}[];
	};

	return manifest.routes
		.map((route) => route.routeData)
		.filter(
			(route) =>
				route.origin === "project" &&
				route.prerender &&
				route.type === "page" &&
				!route.route.startsWith("/_"),
		)
		.map((route) => route.route)
		.sort();
}

// The wrangler config the adapter actually emits for deployment, which is the
// only place the merged env + asset settings can be read back.
function deployedAssetsConfig(): { html_handling?: string; run_worker_first?: string[] } {
	const deployedConfig = JSON.parse(
		readFileSync(resolve(root, "dist", "server", "wrangler.json"), "utf8"),
	) as { assets?: { html_handling?: string; run_worker_first?: string[] } };

	return deployedConfig.assets ?? {};
}

function walkFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const file = resolve(dir, entry);
		return statSync(file).isDirectory() ? walkFiles(file) : [file];
	});
}

function routeFromHtmlFile(file: string): string {
	const relativePath = file.slice(distClient.length + 1);
	if (relativePath === "index.html") return "/";
	if (relativePath.endsWith("/index.html"))
		return `/${relativePath.slice(0, -"/index.html".length)}`;
	return `/${relativePath.slice(0, -".html".length)}`;
}

function generatedHtmlRoutes(): string[] {
	return walkFiles(distClient)
		.filter((file) => file.endsWith(".html"))
		.map(routeFromHtmlFile)
		.sort();
}

function markdownPathForRoute(route: string): string {
	if (route === "/") return resolve(distClient, "index.md");
	return resolve(distClient, `${route.slice(1)}.md`);
}

// Class names owned by something other than the stylesheet, so Tailwind is not
// expected to emit a rule for them: the Turnstile widget finds its mount point
// by class name and styles itself, and Astro's Shiki highlighter emits these on
// fenced code blocks with the colours inlined in a `style` attribute.
const thirdPartyClasses = new Set(["cf-turnstile", "astro-code", "github-dark", "line"]);

function decodeEntities(value: string): string {
	return value
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&amp;", "&");
}

// A class has a rule when the stylesheet contains `.<class>` terminated by
// something that ends the selector token — otherwise `.border` would match
// `.border-t` and the check would pass on classes that were dropped.
function hasRuleFor(unescapedCss: string, className: string): boolean {
	let index = unescapedCss.indexOf(`.${className}`);

	while (index !== -1) {
		const next = unescapedCss[index + className.length + 1] ?? "";
		if (next === "" || "{,: >~+.)".includes(next)) return true;
		index = unescapedCss.indexOf(`.${className}`, index + 1);
	}

	return false;
}

function collectStyleUsage(): { stylesheets: Set<string>; usedClasses: Set<string> } {
	const stylesheets = new Set<string>();
	const usedClasses = new Set<string>();

	for (const file of walkFiles(distClient).filter((path) => path.endsWith(".html"))) {
		const html = readFileSync(file, "utf8");

		for (const match of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)) {
			stylesheets.add(resolve(distClient, match[1].replace(/^\//, "")));
		}

		for (const match of html.matchAll(/class="([^"]+)"/g)) {
			for (const token of decodeEntities(match[1]).split(/\s+/)) {
				if (token) usedClasses.add(token);
			}
		}
	}

	return { stylesheets, usedClasses };
}

// Parses the Cloudflare `_headers` format: an unindented line opens a rule
// block, the indented lines below it are that block's `Name: value` pairs.
function headerRuleBlocks(): Map<string, string[]> {
	const headersFile = resolve(distClient, "_headers");

	if (!existsSync(headersFile)) {
		throw new Error("No _headers file found in build output");
	}

	const blocks = new Map<string, string[]>();
	let currentRules: string[] | undefined;

	for (const line of readFileSync(headersFile, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		if (/^\s/.test(line)) {
			currentRules?.push(trimmed);
			continue;
		}

		currentRules = blocks.get(trimmed) ?? [];
		blocks.set(trimmed, currentRules);
	}

	return blocks;
}

// Every target URI in an RFC 8288 `Link` value is wrapped in angle brackets,
// whether the value carries one link or a comma-separated list of them.
function linkHeaderTargets(rules: readonly string[] = []): string[] {
	return rules
		.filter((rule) => rule.toLowerCase().startsWith("link:"))
		.flatMap((rule) => [...rule.matchAll(/<([^>]+)>/g)].map((match) => match[1]));
}

function buildArtifactExists(path: string): boolean {
	const relativePath = path.replace(/^\//, "");

	return [
		resolve(distClient, relativePath),
		resolve(distClient, relativePath, "index.html"),
		resolve(distClient, `${relativePath}.html`),
	].some((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

describe("static build output", () => {
	beforeAll(async () => {
		await execa("pnpm", ["build"], { cwd: root });
	}, 120_000);

	it("prerenders every static route and sample project route", () => {
		for (const route of prerenderedRoutes) {
			expect(htmlPathFor(route)).toBeTruthy();
		}
	});

	it("keeps each prerendered static page within the 50 KB HTML plus CSS budget", () => {
		for (const route of prerenderedRoutes) {
			if (clientJavaScriptRoutes.has(route)) continue;
			expect(pageTransferSize(htmlPathFor(route))).toBeLessThanOrEqual(maxTransferredBytes);
		}
	});

	it("ships no browser JavaScript on prerendered static pages except contact", () => {
		for (const route of prerenderedRoutes) {
			if (clientJavaScriptRoutes.has(route)) continue;
			const html = readFileSync(htmlPathFor(route), "utf8");
			const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);

			expect(scripts.every((script) => script.includes('type="application/ld+json"'))).toBe(true);
		}
	});

	it("loads the Turnstile widget script only on contact", () => {
		for (const route of prerenderedRoutes) {
			const html = readFileSync(htmlPathFor(route), "utf8");

			if (route === "/contact") {
				expect(html).toContain("https://challenges.cloudflare.com/turnstile/v0/api.js");
				expect(html).toContain("cf-turnstile");
				continue;
			}

			expect(html).not.toContain("https://challenges.cloudflare.com/turnstile/v0/api.js");
			expect(html).not.toContain("cf-turnstile");
		}
	});

	it("renders an accessible contact form with inline outcome containers", () => {
		const html = readFileSync(htmlPathFor("/contact"), "utf8");

		expect(html).toContain('<form id="contact-form"');
		expect(html).toContain('for="name"');
		expect(html).toContain('id="name"');
		expect(html).toContain('for="email"');
		expect(html).toContain('id="email"');
		expect(html).toContain('for="message"');
		expect(html).toContain('id="message"');
		expect(html).toContain('role="status"');
		expect(html).toContain('role="alert"');
		expect(html).toContain('tabindex="-1"');
	});

	it("emits exactly one sitemap, at the path robots.txt advertises", () => {
		// A sitemap integration would add a competing `/sitemap-index.xml` built
		// from its own enumeration of the routes.
		expect(readdirSync(distClient).filter((file) => file.includes("sitemap"))).toEqual([
			"sitemap.xml",
		]);
	});

	it("301s the retired sitemap URLs to the one that replaced them", () => {
		const rules = readFileSync(resolve(distClient, "_redirects"), "utf8")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"))
			.map((line) => line.split(/\s+/));

		// `@astrojs/sitemap` served these on auditmos.com before the sitemap was
		// unified, so they must not start 404ing.
		expect(rules).toEqual([
			["/sitemap-index.xml", "/sitemap.xml", "301"],
			["/sitemap-0.xml", "/sitemap.xml", "301"],
		]);
	});

	it("lists every static route and sample project route in the sitemap", () => {
		const sitemapSource = generatedSitemapSource();

		for (const route of prerenderedRoutes) {
			expect(sitemapSource).toContain(`<loc>https://auditmos.com${route}</loc>`);
		}
	});

	it("serves prerendered pages at the slash-free URL the site declares canonical", () => {
		// Without this the asset server 307s `/about` to `/about/`, contradicting
		// the canonical, og:url, and every internal href, which are all slash-free.
		expect(deployedAssetsConfig().html_handling).toBe("drop-trailing-slash");
	});

	it("routes every prerendered page through the Worker so Accept can be negotiated", () => {
		const workerFirst = new Set(deployedAssetsConfig().run_worker_first ?? []);

		// The asset server would otherwise answer these before the Worker runs,
		// and `Accept: text/markdown` would never be looked at.
		for (const route of astroBuildPageRoutePatterns()) {
			const pattern = route === "/projects/[slug]" ? "/projects/*" : route;

			expect({ route, negotiable: workerFirst.has(pattern) }).toEqual({ route, negotiable: true });
		}
	});

	it("bundles the markdown negotiation layer into the deployed Worker entry", () => {
		// Proves `main: "./src/worker.ts"` was honoured. If the build ever went
		// back to the adapter entrypoint directly, every page would silently
		// serve HTML again while the unit tests kept passing.
		expect(workerEntrySource()).toContain("X-Markdown-Tokens");
	});

	it("points every generated sitemap at the canonical slash-free URL", () => {
		const advertisedUrls = [
			...generatedSitemapSource().matchAll(/<loc>(https:\/\/auditmos\.com[^<]*)<\/loc>/g),
		].map((match) => match[1]);

		expect(advertisedUrls.length).toBeGreaterThan(0);
		expect(
			advertisedUrls.filter((url) => url !== "https://auditmos.com/" && url.endsWith("/")),
		).toEqual([]);
	});

	it("keeps the MD mirror registry aligned with Astro's prerendered page route list", () => {
		const configuredStaticRoutes = new Set<string>(staticPages.map((page) => page.path));

		for (const route of astroBuildPageRoutePatterns()) {
			if (route === "/projects/[slug]") continue;
			expect(configuredStaticRoutes.has(route)).toBe(true);
		}
	});

	it("prerenders markdown mirrors and llms.txt entries for every generated HTML page", () => {
		const llmsTxt = readFileSync(resolve(distClient, "llms.txt"), "utf8");

		for (const route of generatedHtmlRoutes()) {
			const markdownPath = route === "/" ? "/index.md" : `${route}.md`;

			expect(existsSync(markdownPathForRoute(route))).toBe(true);
			expect(readFileSync(markdownPathForRoute(route), "utf8")).toMatch(/^# /);
			expect(llmsTxt).toContain(`https://auditmos.com${markdownPath}`);
		}
	});

	it("ships a CSS rule for every class the built HTML actually uses", () => {
		// `globals.css` narrows Tailwind to `.astro` sources so plain TypeScript
		// tokens stop generating dead utilities. This is the safety net for that:
		// narrowing must never drop a class the markup depends on.
		const { stylesheets, usedClasses } = collectStyleUsage();

		// Tailwind escapes selector punctuation (`.md\:flex`); dropping the escapes
		// lets a plain substring match line up with the class as authored.
		const unescapedCss = [...stylesheets]
			.map((sheet) => readFileSync(sheet, "utf8"))
			.join("\n")
			.replaceAll("\\", "");

		const missing = [...usedClasses]
			.filter((className) => !thirdPartyClasses.has(className))
			.filter((className) => !hasRuleFor(unescapedCss, className));

		expect(usedClasses.size).toBeGreaterThan(100);
		expect(missing).toEqual([]);
	});

	it("advertises RFC 8288 agent-discovery Link relations site-wide and on the homepage", () => {
		const blocks = headerRuleBlocks();
		const siteWideRules = blocks.get("/*") ?? [];
		const homepageRules = blocks.get("/") ?? [];

		expect(linkHeaderTargets(siteWideRules)).toEqual([
			"/llms.txt",
			"/agents.json",
			"/.well-known/ai-catalog.json",
			"/about",
			"/privacy",
		]);
		expect(siteWideRules.join("\n")).toContain('rel="service-desc"');
		expect(siteWideRules.join("\n")).toContain('rel="privacy-policy"');

		expect(linkHeaderTargets(homepageRules)).toEqual(["/index.md"]);
		expect(homepageRules.join("\n")).toContain('rel="alternate"; type="text/markdown"');
	});

	it("advertises the markdown twin of every generated page on both of its URL forms", () => {
		const blocks = headerRuleBlocks();
		const routes = generatedHtmlRoutes();

		expect(routes.length).toBeGreaterThan(1);

		for (const route of routes) {
			const markdownTwin = route === "/" ? "/index.md" : `${route}.md`;
			// `/about` serves the 200 and `/about/` 307s to it — cover both.
			const patterns = route === "/" ? [route] : [route, `${route}/`];

			for (const pattern of patterns) {
				expect({ pattern, targets: linkHeaderTargets(blocks.get(pattern)) }).toEqual({
					pattern,
					targets: [markdownTwin],
				});
			}
		}
	});

	it("points every advertised Link target at a real build artifact", () => {
		const targets = [...headerRuleBlocks().values()].flatMap((rules) => linkHeaderTargets(rules));

		expect(targets.length).toBeGreaterThan(0);
		expect(targets.filter((target) => !buildArtifactExists(target))).toEqual([]);
	});

	it("serves the MCP Server Card at both its reserved and well-known locations", () => {
		const cards = SERVER_CARD_PATHS.map((path) =>
			JSON.parse(readFileSync(resolve(distClient, path.replace(/^\//, "")), "utf8")),
		);

		// One document, two URLs — a client following the catalog and a scanner
		// following convention must not get different answers.
		expect(cards).toHaveLength(2);
		expect(cards[0]).toEqual(cards[1]);
		expect(cards[0]).toMatchObject({ name: expect.stringContaining("/") as unknown as string });
	});

	it("points the AI catalog at a Server Card the build actually generated", () => {
		const catalog = JSON.parse(
			readFileSync(resolve(distClient, AI_CATALOG_PATH.replace(/^\//, "")), "utf8"),
		) as { entries: { url: string }[] };

		for (const entry of catalog.entries) {
			const path = new URL(entry.url).pathname.replace(/^\//, "");

			expect({ url: entry.url, generated: existsSync(resolve(distClient, path)) }).toEqual({
				url: entry.url,
				generated: true,
			});
		}
	});

	it("states the content usage policy on every response, matching robots.txt", () => {
		const signal = `Content-Signal: ${CONTENT_SIGNAL}`;

		// robots.txt reaches only clients that fetch it; the header reaches every
		// asset request, including the `.md` twins and negotiated page responses.
		expect(headerRuleBlocks().get("/*")).toContain(signal);
		expect(readFileSync(resolve(distClient, "robots.txt"), "utf8")).toContain(signal);
	});

	it("keeps the adapter's immutable asset cache rule alongside the discovery rules", () => {
		expect(headerRuleBlocks().get("/_astro/*")).toContain(
			"Cache-Control: public, max-age=31536000, immutable",
		);
	});

	it("renders both named-client and anonymised-sector sample project detail pages", () => {
		const namedClientHtml = readFileSync(htmlPathFor("/projects/auditmos-website-rebuild"), "utf8");
		const anonymisedHtml = readFileSync(
			htmlPathFor("/projects/regulated-platform-security-review"),
			"utf8",
		);

		expect(namedClientHtml).toContain("Auditmos OÜ");
		expect(namedClientHtml).toContain("Discuss it with Auditmos");
		expect(anonymisedHtml).toContain("Banking");
		expect(anonymisedHtml).toContain("Discuss it with Auditmos");
	});
});
