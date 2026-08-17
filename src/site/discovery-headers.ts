/**
 * Agent-facing response headers: RFC 8288 `Link` relations plus the site's
 * `Content-Signal` content usage policy.
 *
 * A third machine-readable surface alongside the MD mirror and `/llms.txt`,
 * derived from the pages that actually landed in the build output so it can
 * never advertise a route that was not generated.
 *
 * Node-only: `astro.config.mjs` is the sole importer, so nothing here is
 * bundled into the Worker.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { API_CATALOG_MEDIA_TYPE, API_CATALOG_PATH, agentSurfaces } from "../agents/surfaces";
import { SERVER_CARD_WELL_KNOWN_PATH } from "../mcp/server-card";
import {
	CSP_HEADER_NAME,
	executableInlineScripts,
	renderContentSecurityPolicy,
} from "./content-security-policy";
import { ROBOTS_TAG_HEADER_NAME, robotsTagFor, SECURITY_HEADERS } from "./security-headers";

interface DiscoveryLink {
	readonly target: string;
	readonly rel: string;
	readonly type?: string;
	readonly title?: string;
}

const markdownTwinTitle = "Markdown twin of this page";

/**
 * The content usage policy, stated on every response so an agent that never
 * fetches `robots.txt` still receives it — the same header Cloudflare's
 * Markdown for Agents emits. `public/robots.txt` declares the identical value
 * under its `User-agent` group, and `crawler-source.test.ts` fails if the two
 * drift, since a site stating two different policies has stated none.
 *
 * Rationale for the values is in the PRD (component 11); in short, reading
 * this site with an agent is the point, training on it is not granted.
 */
export const CONTENT_SIGNAL = "ai-train=no, search=yes, ai-input=yes";

// Only IANA-registered relation types: api-catalog (RFC 9727), service-desc
// (RFC 8631), service-meta (RFC 8631), author (HTML), privacy-policy (RFC
// 6903), alternate (HTML).
//
// The catalog leads: it is the one document that names all the others, so a
// client that reads a single relation should read that one. Everything after it
// is projected from the surface registry rather than restated here — a surface
// added there becomes a `Link` header with no edit to this file.
const siteWideLinks: readonly DiscoveryLink[] = [
	{
		target: API_CATALOG_PATH,
		rel: "api-catalog",
		type: API_CATALOG_MEDIA_TYPE,
		title: "Auditmos API catalog (every machine-readable surface)",
	},
	...agentSurfaces.map((surface) => ({
		target: surface.path,
		rel: surface.relation,
		type: surface.mediaType,
		title: surface.title,
	})),
	{ target: "/about", rel: "author" },
	{ target: "/privacy", rel: "privacy-policy" },
];

const fileBanner = `# Agent discovery — RFC 8288 Link relations + Content-Signal policy.
#
# Generated at build time from the pages that landed in the build output.
# Do not edit by hand — source: src/site/discovery-headers.ts.
#
# Workers joins repeated header names with a comma, which is exactly the
# RFC 8288 list form, so each \`Link:\` line becomes one list member.`;

function markdownTwinOf(route: string): string {
	return route === "/" ? "/index.md" : `${route}.md`;
}

// `/about` is canonical and serves the 200; the asset server 307s `/about/` to
// it (`html_handling: "drop-trailing-slash"`). Both forms carry the rule so an
// agent that requests the slash form still gets the links off the redirect.
function patternsFor(route: string): string[] {
	return route === "/" ? [route] : [route, `${route}/`];
}

function renderLink(link: DiscoveryLink): string {
	const parameters = [`rel="${link.rel}"`];
	if (link.type) parameters.push(`type="${link.type}"`);
	if (link.title) parameters.push(`title="${link.title}"`);

	return `<${link.target}>; ${parameters.join("; ")}`;
}

function renderRule(pattern: string, headers: readonly string[]): string {
	return [pattern, ...headers.map((header) => `  ${header}`)].join("\n");
}

function linkHeaders(links: readonly DiscoveryLink[]): string[] {
	return links.map((link) => `Link: ${renderLink(link)}`);
}

/**
 * Content types the asset server cannot infer from the filename.
 *
 * A prerendered endpoint's own `Response` headers do not survive the build:
 * the output is a static file, and Cloudflare types it by extension. That
 * leaves every `.well-known` document reserved without one — the Server Card,
 * the API catalog, all three OAuth metadata documents — with *no* Content-Type
 * at all, and silently downgrades the ones that do have an extension to
 * whatever the extension implies. These rules restate what each endpoint
 * intended, at the layer that actually serves it.
 *
 * Projected from the surface registry rather than listed by hand, so a new
 * surface arrives here with its media type already correct. Where the extension
 * would have produced the right type anyway, the rule still earns its place:
 * every one of these documents needs the CORS header, which the asset server
 * never adds on its own.
 *
 * CORS is wide open because these are public read-only metadata that
 * browser-based agents fetch cross-origin, exactly the case SEP-2127 calls
 * acceptable.
 */
const mediaTypeRules: readonly { pattern: string; type: string }[] = [
	// RFC 9727 reserves `/.well-known/api-catalog` without an extension, so the
	// asset server has nothing to infer the linkset media type from. Not a
	// registered surface: the catalog is the index of the registry, not in it.
	{ pattern: API_CATALOG_PATH, type: API_CATALOG_MEDIA_TYPE },
	...agentSurfaces.map((surface) => ({ pattern: surface.path, type: surface.mediaType })),
	// The Server Card's `.well-known` mirror. The reserved location is what the
	// registry lists; this copy exists for clients that arrive by convention.
	{ pattern: SERVER_CARD_WELL_KNOWN_PATH, type: "application/json" },
];

export function renderDiscoveryHeaders(
	pageRoutes: readonly string[],
	scriptHashes: readonly string[] = [],
	cloudflareEnv: string | undefined = undefined,
): string {
	// Undefined env means a local or dev build, and those stay out of search
	// engines too — only a build explicitly stamped `production` by the deploy
	// script may be indexed. Rationale on `robotsTagFor`.
	const robotsTag = robotsTagFor(cloudflareEnv);
	// The policy leads the site-wide block: it governs what a client may do with
	// everything the Link relations then point at.
	// Security headers last: they are unconditional and uninteresting to a
	// client reading the file, and appending them keeps the policy and the
	// catalog at the top where a reader looks first.
	//
	// The CSP is stated once, under `/*`, and never per page. Workers joins
	// repeated header names with a comma, and a comma-separated CSP value is two
	// policies both enforced in full rather than one policy with more sources —
	// so a page-level rule would be intersected with this one and lose whatever
	// this one omits. A hash admitted for one page is therefore admitted for all
	// of them, which is the usual trade for a statically served site.
	const siteWideHeaders = [
		`Content-Signal: ${CONTENT_SIGNAL}`,
		...linkHeaders(siteWideLinks),
		...Object.entries(SECURITY_HEADERS).map(([name, value]) => `${name}: ${value}`),
		...(robotsTag ? [`${ROBOTS_TAG_HEADER_NAME}: ${robotsTag}`] : []),
		`${CSP_HEADER_NAME}: ${renderContentSecurityPolicy(scriptHashes)}`,
	];
	const alternateRules = [...pageRoutes].sort().flatMap((route) =>
		patternsFor(route).map((pattern) =>
			renderRule(
				pattern,
				linkHeaders([
					{
						target: markdownTwinOf(route),
						rel: "alternate",
						type: "text/markdown",
						title: markdownTwinTitle,
					},
				]),
			),
		),
	);

	const mediaTypeRuleBlocks = mediaTypeRules.map((rule) =>
		renderRule(rule.pattern, [
			`Content-Type: ${rule.type}; charset=utf-8`,
			"Access-Control-Allow-Origin: *",
		]),
	);

	return `${[
		fileBanner,
		renderRule("/*", siteWideHeaders),
		...mediaTypeRuleBlocks,
		...alternateRules,
	].join("\n\n")}\n`;
}

function walkFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		return entry.isDirectory() ? walkFiles(path) : [path];
	});
}

function routeOf(clientDir: string, htmlFile: string): string {
	const relativePath = relative(clientDir, htmlFile).split(sep).join("/");

	if (relativePath === "index.html") return "/";
	if (relativePath.endsWith("/index.html")) {
		return `/${relativePath.slice(0, -"/index.html".length)}`;
	}

	return `/${relativePath.slice(0, -".html".length)}`;
}

/**
 * A base64 SHA-256 digest of every inline script the build emitted, deduped.
 *
 * Derived from the HTML rather than written down, because a hardcoded list rots
 * on the first copy edit and fails *closed*: the browser refuses the script and
 * the page renders without it. Sorted so an unchanged build produces an
 * unchanged `_headers` file.
 */
function inlineScriptHashes(clientDir: string): string[] {
	const digests = walkFiles(clientDir)
		.filter((file) => file.endsWith(".html"))
		.flatMap((file) => executableInlineScripts(readFileSync(file, "utf8")))
		.map((body) => createHash("sha256").update(body, "utf8").digest("base64"));

	return [...new Set(digests)].sort();
}

function mirroredRoutes(clientDir: string): string[] {
	return walkFiles(clientDir)
		.filter((file) => file.endsWith(".html"))
		.map((file) => routeOf(clientDir, file))
		.filter((route) => existsSync(join(clientDir, markdownTwinOf(route).slice(1))));
}

export function agentDiscoveryHeaders(): AstroIntegration {
	return {
		name: "auditmos:discovery-headers",
		hooks: {
			"astro:build:done": ({ dir, logger }) => {
				const clientDir = fileURLToPath(dir);
				const headersFile = join(clientDir, "_headers");
				const routes = mirroredRoutes(clientDir);
				// `@astrojs/cloudflare` writes its immutable `/_astro/*` cache rule to
				// this file from an earlier `astro:build:done` hook, and `_headers`
				// rules are additive — so append rather than replace.
				const existing = existsSync(headersFile) ? readFileSync(headersFile, "utf8").trimEnd() : "";
				// The same CLOUDFLARE_ENV `scripts/deploy.ts` exports into the build —
				// unset on a local `pnpm build`, which is what makes a local build
				// noindex by default.
				const discoveryHeaders = renderDiscoveryHeaders(
					routes,
					inlineScriptHashes(clientDir),
					process.env.CLOUDFLARE_ENV,
				);

				writeFileSync(
					headersFile,
					existing ? `${existing}\n\n${discoveryHeaders}` : discoveryHeaders,
				);
				logger.info(`Advertised ${routes.length} markdown twins as RFC 8288 Link relations.`);
			},
		},
	};
}
