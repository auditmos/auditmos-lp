/**
 * What the generated `_headers` file must say.
 *
 * A coherent group of its own: these assertions never look at markup or at the
 * Worker bundle, only at the response headers Cloudflare's asset server will
 * replay for every file the build emitted. They share the one production build
 * with the rest of the suite — see `./build-once`.
 */

import { createHash } from "node:crypto";
import { API_CATALOG_PATH, agentSurfaces } from "@/agents/surfaces";
import { buildRunCount } from "./build-once";
import {
	assetText,
	buildArtifactExists,
	buildSite,
	generatedHtmlRoutes,
	headerRuleBlocks,
	htmlFor,
	inlineScriptsIn,
	linkHeaderTargets,
	markdownTwinPathFor,
} from "./build-output";
import { CSP_HEADER_NAME } from "./content-security-policy";
import { CONTENT_SIGNAL } from "./discovery-headers";
import { SECURITY_HEADERS } from "./security-headers";

/** The one site-wide policy, as the asset server will replay it. */
function contentSecurityPolicy(): string {
	const rules = headerRuleBlocks().get("/*") ?? [];
	const policies = rules.filter((rule) => rule.startsWith(`${CSP_HEADER_NAME}:`));

	expect(policies).toHaveLength(1);

	return policies[0] ?? "";
}

describe("generated _headers", () => {
	beforeAll(async () => {
		await buildSite();
	}, 180_000);

	it("shares the one production build with the rest of the suite", () => {
		// Two suites read `dist/`, and `astro build` empties it before writing.
		// A second build would mean one of them was reading a directory the other
		// had just wiped — intermittently, which is the worst way to find out.
		expect(buildRunCount()).toBe(1);
	});

	it("carries the baseline security headers on every asset the server answers", () => {
		// `_headers` reaches everything the asset server serves, which is every
		// static file plus the prerendered pages behind `run_worker_first`.
		const siteWideRules = headerRuleBlocks().get("/*") ?? [];

		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			expect(siteWideRules).toContain(`${name}: ${value}`);
		}
	});

	it("admits every executable inline script the build emitted, by the hash of its body", () => {
		// The check the hardcoded-hash approach cannot have: hashes are derived
		// from the emitted HTML, so this fails the moment an inline block is added
		// or a character inside one changes without the policy following. It fails
		// closed in production — a browser refuses the script and the page renders
		// without it — which is exactly the failure a test has to catch first.
		const policy = contentSecurityPolicy();
		const inline = generatedHtmlRoutes()
			.flatMap((route) => inlineScriptsIn(htmlFor(route)))
			.filter((script) => !/\bsrc=/.test(script.tag));
		const unhashed = inline.filter(
			(script) =>
				!policy.includes(
					`'sha256-${createHash("sha256").update(script.body, "utf8").digest("base64")}'`,
				),
		);

		expect(inline.length).toBeGreaterThan(0);
		// What the policy does not name has to be a data block — a `<script>` the
		// browser parses and never executes, and so never checks against
		// `script-src`. Any other tag surfacing here is a script that would be
		// refused, and the diff names it.
		expect(unhashed.map((script) => script.tag)).toEqual(
			unhashed.map(() => '<script type="application/ld+json">'),
		);
	});

	it("advertises RFC 8288 agent-discovery Link relations site-wide and on the homepage", () => {
		const blocks = headerRuleBlocks();
		const siteWideRules = blocks.get("/*") ?? [];
		const homepageRules = blocks.get("/") ?? [];

		expect(linkHeaderTargets(siteWideRules)).toEqual([
			API_CATALOG_PATH,
			...agentSurfaces.map((surface) => surface.path),
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
			// `/about` serves the 200 and `/about/` 307s to it — cover both.
			const patterns = route === "/" ? [route] : [route, `${route}/`];

			for (const pattern of patterns) {
				expect({ pattern, targets: linkHeaderTargets(blocks.get(pattern)) }).toEqual({
					pattern,
					targets: [markdownTwinPathFor(route)],
				});
			}
		}
	});

	it("points every advertised Link target at a real build artifact", () => {
		const targets = [...headerRuleBlocks().values()].flatMap((rules) => linkHeaderTargets(rules));

		expect(targets.length).toBeGreaterThan(0);
		expect(targets.filter((target) => !buildArtifactExists(target))).toEqual([]);
	});

	it("restates the media type of every registered surface the extension would hide", () => {
		const blocks = headerRuleBlocks();

		for (const surface of agentSurfaces) {
			expect({ path: surface.path, rules: blocks.get(surface.path) ?? [] }).toEqual({
				path: surface.path,
				rules: expect.arrayContaining([
					`Content-Type: ${surface.mediaType}; charset=utf-8`,
					"Access-Control-Allow-Origin: *",
				]) as unknown as string[],
			});
		}
	});

	it("restates the API catalog's media type, which its extensionless path hides", () => {
		expect(headerRuleBlocks().get(API_CATALOG_PATH)).toContain(
			"Content-Type: application/linkset+json; charset=utf-8",
		);
	});

	it("states the content usage policy on every response, matching robots.txt", () => {
		const signal = `Content-Signal: ${CONTENT_SIGNAL}`;

		// robots.txt reaches only clients that fetch it; the header reaches every
		// asset request, including the `.md` twins and negotiated page responses.
		expect(headerRuleBlocks().get("/*")).toContain(signal);
		expect(assetText("robots.txt")).toContain(signal);
	});

	it("keeps the adapter's immutable asset cache rule alongside the discovery rules", () => {
		expect(headerRuleBlocks().get("/_astro/*")).toContain(
			"Cache-Control: public, max-age=31536000, immutable",
		);
	});
});
