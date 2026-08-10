/**
 * Readers over what `astro build` actually emitted.
 *
 * The build-output test asserts properties of a real build rather than of the
 * code that produced it — that is the whole point of it, and it is why the
 * assertions are worth their runtime. But "read the emitted artifact" turned
 * out to be most of the file: manifest extraction, `_headers` parsing, asset
 * lookup across the three shapes a route can land in, CSS coverage. All of it
 * is machinery, none of it is the claim being made.
 *
 * So it lives here, behind a small interface of readers, and the test file next
 * door reads as a list of things that must be true about the site.
 *
 * **Node-only, test support.** This module touches `node:fs` and shells out to
 * the build; nothing in the application may import it, or the Worker bundle
 * would pull in the filesystem. Same constraint as `discovery-headers.ts`.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";

const root = resolve(import.meta.dirname, "..", "..");
const distClient = resolve(root, "dist", "client");

/** Class names owned by something other than the stylesheet, so Tailwind is
 * not expected to emit a rule for them: the Turnstile widget finds its mount
 * point by class name and styles itself, and Astro's Shiki highlighter emits
 * these on fenced code blocks with the colours inlined in a `style` attribute. */
const thirdPartyClasses = new Set(["cf-turnstile", "astro-code", "github-dark-default", "line"]);

/** Runs the production build the assertions then read. */
export async function buildSite(): Promise<void> {
	await execa("pnpm", ["build"], { cwd: root });
}

function distPath(urlPath: string): string {
	return resolve(distClient, urlPath.replace(/^\//, ""));
}

function walkFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const file = resolve(dir, entry);
		return statSync(file).isDirectory() ? walkFiles(file) : [file];
	});
}

/** The emitted HTML file for a route, in whichever of the two shapes it took. */
export function htmlPathFor(route: string): string {
	const path = route === "/" ? "index" : route.slice(1);
	const candidates = [resolve(distClient, `${path}.html`), resolve(distClient, path, "index.html")];
	const match = candidates.find((candidate) => existsSync(candidate));

	if (!match) {
		throw new Error(`No prerendered HTML found for ${route}`);
	}

	return match;
}

export function htmlFor(route: string): string {
	return readFileSync(htmlPathFor(route), "utf8");
}

/** A built file, read by the URL path that serves it. */
export function assetText(urlPath: string): string {
	return readFileSync(distPath(urlPath), "utf8");
}

export function assetJson<T = unknown>(urlPath: string): T {
	return JSON.parse(assetText(urlPath)) as T;
}

export function assetExists(urlPath: string): boolean {
	return existsSync(distPath(urlPath));
}

export function assetSha256(urlPath: string): string {
	return createHash("sha256")
		.update(readFileSync(distPath(urlPath)))
		.digest("hex");
}

/**
 * True when a URL resolves to something the build produced, in any of the three
 * shapes a route can take: a bare file, a directory index, or a sibling `.html`.
 */
export function buildArtifactExists(urlPath: string): boolean {
	const relativePath = urlPath.replace(/^\//, "");

	return [
		resolve(distClient, relativePath),
		resolve(distClient, relativePath, "index.html"),
		resolve(distClient, `${relativePath}.html`),
	].some((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function cssFilesFor(html: string): string[] {
	return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)].map((match) =>
		resolve(distClient, match[1].replace(/^\//, "")),
	);
}

/** HTML plus the stylesheets it pulls in — what a first visit actually costs. */
export function pageTransferSize(route: string): number {
	const htmlFile = htmlPathFor(route);
	const cssBytes = cssFilesFor(readFileSync(htmlFile, "utf8")).reduce(
		(total, cssFile) => total + (existsSync(cssFile) ? statSync(cssFile).size : 0),
		0,
	);

	return statSync(htmlFile).size + cssBytes;
}

function routeFromHtmlFile(file: string): string {
	const relativePath = file.slice(distClient.length + 1);
	if (relativePath === "index.html") return "/";
	if (relativePath.endsWith("/index.html")) {
		return `/${relativePath.slice(0, -"/index.html".length)}`;
	}
	return `/${relativePath.slice(0, -".html".length)}`;
}

export function generatedHtmlRoutes(): string[] {
	return walkFiles(distClient)
		.filter((file) => file.endsWith(".html"))
		.map(routeFromHtmlFile)
		.sort();
}

export function markdownTwinPathFor(route: string): string {
	return route === "/" ? "/index.md" : `${route}.md`;
}

export function sitemapFileNames(): string[] {
	return readdirSync(distClient).filter((file) => file.includes("sitemap"));
}

export function generatedSitemapSource(): string {
	return sitemapFileNames()
		.map((file) => readFileSync(resolve(distClient, file), "utf8"))
		.join("\n");
}

/** `_redirects` as rows of whitespace-separated fields, comments dropped. */
export function redirectRules(): string[][] {
	return assetText("_redirects")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"))
		.map((line) => line.split(/\s+/));
}

export function workerEntrySource(): string {
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

interface AstroRouteData {
	origin: string;
	params: string[];
	prerender: boolean;
	route: string;
	type: string;
}

function astroManifestRoutes(): AstroRouteData[] {
	const source = workerEntrySource();
	// Astro emits `var _manifest = deserializeManifest({...})` in the SSR entry;
	// match on the assignment so a `const`/`var` change doesn't break parsing.
	const marker = "_manifest = deserializeManifest(";
	const start = source.indexOf(marker);

	if (start === -1) {
		throw new Error("No serialized Astro manifest found in worker entry");
	}

	const manifest = JSON.parse(extractJsonObject(source, start + marker.length)) as {
		routes: { routeData: AstroRouteData }[];
	};

	return manifest.routes.map((route) => route.routeData);
}

/**
 * Routes the deployed Worker renders on demand: they produce no file in the
 * build output, so "does this URL resolve" has to consult the manifest too.
 */
export function astroOnDemandRoutePatterns(): Set<string> {
	return new Set(
		astroManifestRoutes()
			.filter((route) => !route.prerender && route.origin === "project")
			.map((route) => route.route),
	);
}

export function astroBuildPageRoutePatterns(): string[] {
	return astroManifestRoutes()
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

/**
 * The wrangler config the adapter actually emits for deployment, which is the
 * only place the merged env + asset settings can be read back.
 */
export function deployedAssetsConfig(): { html_handling?: string; run_worker_first?: string[] } {
	const deployedConfig = JSON.parse(
		readFileSync(resolve(root, "dist", "server", "wrangler.json"), "utf8"),
	) as { assets?: { html_handling?: string; run_worker_first?: string[] } };

	return deployedConfig.assets ?? {};
}

/**
 * Parses the Cloudflare `_headers` format: an unindented line opens a rule
 * block, the indented lines below it are that block's `Name: value` pairs.
 */
export function headerRuleBlocks(): Map<string, string[]> {
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

/**
 * Every target URI in an RFC 8288 `Link` value is wrapped in angle brackets,
 * whether the value carries one link or a comma-separated list of them.
 */
export function linkHeaderTargets(rules: readonly string[] = []): string[] {
	return rules
		.filter((rule) => rule.toLowerCase().startsWith("link:"))
		.flatMap((rule) => [...rule.matchAll(/<([^>]+)>/g)].map((match) => match[1]));
}

export interface InlineScript {
	tag: string;
	body: string;
}

export function inlineScriptsIn(html: string): InlineScript[] {
	return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(([tag, body]) => ({
		tag: tag.slice(0, tag.indexOf(">") + 1),
		body,
	}));
}

/**
 * The body of the one inline script containing `needle`.
 *
 * Written as a scan rather than one regex because the obvious
 * `<script[^>]*>[\s\S]*?needle[\s\S]*?</script>` starts at the page's *first*
 * script element and swallows everything up to the match — which once made a
 * size assertion measure 18 KB of JSON-LD instead of the 1.8 KB it meant to.
 */
export function scriptContaining(html: string, needle: string): string | undefined {
	return inlineScriptsIn(html).find((script) => script.body.includes(needle))?.body;
}

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

export interface CssCoverage {
	/** How many distinct classes the built markup uses. */
	usedClassCount: number;
	/** Classes the markup uses that no shipped stylesheet has a rule for. */
	missing: string[];
}

/**
 * Cross-checks every class the built HTML uses against the CSS it ships.
 * `globals.css` narrows Tailwind's sources, and this is the safety net for
 * that: narrowing must never drop a class the markup depends on.
 *
 * Inline `<style>` blocks count as shipped CSS, not just `<link>`ed
 * stylesheets. Astro inlines any stylesheet under the asset limit, which is
 * how a page-scoped sheet like `prose.css` arrives — reading only the links
 * would report every class it defines as missing.
 */
export function cssCoverage(): CssCoverage {
	const cssSources: string[] = [];
	const stylesheets = new Set<string>();
	const usedClasses = new Set<string>();

	for (const file of walkFiles(distClient).filter((path) => path.endsWith(".html"))) {
		const html = readFileSync(file, "utf8");

		for (const match of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)) {
			stylesheets.add(resolve(distClient, match[1].replace(/^\//, "")));
		}

		for (const match of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
			cssSources.push(match[1]);
		}

		for (const match of html.matchAll(/class="([^"]+)"/g)) {
			for (const token of decodeEntities(match[1]).split(/\s+/)) {
				if (token) usedClasses.add(token);
			}
		}
	}

	// Tailwind escapes selector punctuation (`.md\:flex`); dropping the escapes
	// lets a plain substring match line up with the class as authored.
	const unescapedCss = [...stylesheets]
		.map((sheet) => readFileSync(sheet, "utf8"))
		.concat(cssSources)
		.join("\n")
		.replaceAll("\\", "");

	return {
		usedClassCount: usedClasses.size,
		missing: [...usedClasses]
			.filter((className) => !thirdPartyClasses.has(className))
			.filter((className) => !hasRuleFor(unescapedCss, className)),
	};
}
