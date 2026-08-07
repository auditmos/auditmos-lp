/**
 * Agent-discovery response headers (RFC 8288 `Link`).
 *
 * A third machine-readable surface alongside the MD mirror and `/llms.txt`,
 * derived from the pages that actually landed in the build output so it can
 * never advertise a route that was not generated.
 *
 * Node-only: `astro.config.mjs` is the sole importer, so nothing here is
 * bundled into the Worker.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

interface DiscoveryLink {
	readonly target: string;
	readonly rel: string;
	readonly type?: string;
	readonly title?: string;
}

const markdownTwinTitle = "Markdown twin of this page";

// Only IANA-registered relation types: service-desc (RFC 8631), author (HTML),
// privacy-policy (RFC 6903), alternate (HTML).
const siteWideLinks: readonly DiscoveryLink[] = [
	{
		target: "/llms.txt",
		rel: "service-desc",
		type: "text/plain",
		title: "Auditmos site index for AI agents",
	},
	{
		// The same document `_index._agents.auditmos.com` resolves to, so an agent
		// that arrives over HTTP finds the agent inventory without a DNS lookup.
		target: "/agents.json",
		rel: "service-desc",
		type: "application/json",
		title: "Auditmos agent index (DNS-AID)",
	},
	{ target: "/about", rel: "author" },
	{ target: "/privacy", rel: "privacy-policy" },
];

const fileBanner = `# Agent discovery — RFC 8288 Link relation headers.
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

function renderRule(pattern: string, links: readonly DiscoveryLink[]): string {
	return [pattern, ...links.map((link) => `  Link: ${renderLink(link)}`)].join("\n");
}

export function renderDiscoveryHeaders(pageRoutes: readonly string[]): string {
	const alternateRules = [...pageRoutes].sort().flatMap((route) =>
		patternsFor(route).map((pattern) =>
			renderRule(pattern, [
				{
					target: markdownTwinOf(route),
					rel: "alternate",
					type: "text/markdown",
					title: markdownTwinTitle,
				},
			]),
		),
	);

	return `${[fileBanner, renderRule("/*", siteWideLinks), ...alternateRules].join("\n\n")}\n`;
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
				const discoveryHeaders = renderDiscoveryHeaders(routes);

				writeFileSync(
					headersFile,
					existing ? `${existing}\n\n${discoveryHeaders}` : discoveryHeaders,
				);
				logger.info(`Advertised ${routes.length} markdown twins as RFC 8288 Link relations.`);
			},
		},
	};
}
