/**
 * What must be true of a real production build.
 *
 * These assertions run against the artifacts `astro build` emits, not against
 * the code that emits them — which is the point: most of what can go wrong here
 * goes wrong between the source and the file that ships. The machinery for
 * reading those artifacts lives in `./build-output`, so this file stays a list
 * of claims about the site.
 */

import { A2A_AGENT_CARD_PATH } from "@/agents/agent-card";
import { AGENT_SKILLS_INDEX_PATH } from "@/agents/skills";
import { API_CATALOG_PATH, agentSurfaces } from "@/agents/surfaces";
import { renderWebMcpScript, WEB_MCP_TOOL_NAMES } from "@/agents/web-mcp";
import { AI_CATALOG_PATH, SERVER_CARD_PATHS } from "@/mcp/server-card";
import {
	AUTH_DOC_PATH,
	OAUTH_AUTHORIZATION_SERVER_PATHS,
	OAUTH_PROTECTED_RESOURCE_PATH,
} from "@/oauth/server";
import { buildRunCount } from "./build-once";
import {
	assetExists,
	assetJson,
	assetSha256,
	assetText,
	astroBuildPageRoutePatterns,
	astroOnDemandRoutePatterns,
	buildArtifactExists,
	buildSite,
	cssCoverage,
	deployedAssetsConfig,
	generatedHtmlRoutes,
	generatedSitemapSource,
	headerRuleBlocks,
	htmlFor,
	htmlPathFor,
	inlineScriptsIn,
	markdownTwinPathFor,
	pageTransferSize,
	redirectRules,
	scriptContaining,
	sitemapFileNames,
	workerEntrySource,
} from "./build-output";
import { CSP_REPORT_PATH } from "./content-security-policy";
import { staticPages } from "./pages";
import { claimsPath } from "./run-worker-first";

// 52 KB: the original 50 KB budget plus ~2 KB of CSS for the self-hosted brand
// typefaces (Space Grotesk + IBM Plex Mono @font-face) and texture utilities.
const maxTransferredBytes = 52 * 1024;
// A case study is long-form by design: the body is the SEO asset, so it gets its
// own ceiling rather than being trimmed to a marketing page's shape. This one is
// ~30 KB of HTML against a service page's 12-15 KB, and 64 KB still catches a
// runaway page. Both numbers are uncompressed — over the wire the same page is
// ~11 KB of HTML plus ~6 KB of CSS after gzip.
const maxProjectTransferredBytes = 64 * 1024;
const sampleProjectRoutes = ["/work/client-owned-gpu-fleet-crm"] as const;
const projectRoutes = new Set<string>(sampleProjectRoutes);
const prerenderedRoutes = [
	...staticPages.map((page) => page.path),
	...sampleProjectRoutes,
] as const;
const clientJavaScriptRoutes = new Set<string>(["/contact"]);

describe("static build output", () => {
	beforeAll(async () => {
		await buildSite();
	}, 180_000);

	it("shares the one production build with the rest of the suite", () => {
		// `astro build` empties `dist/` before writing it, and vitest runs suites
		// in parallel workers. A second build would mean one suite reading a
		// directory the other had just wiped — intermittently, so a green run
		// would prove nothing. See `./build-once`.
		expect(buildRunCount()).toBe(1);
	});

	it("prerenders every static route and sample project route", () => {
		for (const route of prerenderedRoutes) {
			expect(htmlPathFor(route)).toBeTruthy();
		}
	});

	it("keeps each prerendered page within its HTML plus CSS budget", () => {
		// The homepage gets exactly the WebMCP script's own bytes on top, and not
		// a byte more: the content budget is unchanged, the script is a declared,
		// separately-capped addition rather than a reason to loosen the limit.
		const webMcpBytes = new TextEncoder().encode(renderWebMcpScript()).byteLength;

		for (const route of prerenderedRoutes) {
			if (clientJavaScriptRoutes.has(route)) continue;
			const budget = projectRoutes.has(route)
				? maxProjectTransferredBytes
				: route === "/"
					? maxTransferredBytes + webMcpBytes
					: maxTransferredBytes;

			expect({ route, withinBudget: pageTransferSize(route) <= budget }).toEqual({
				route,
				withinBudget: true,
			});
		}
	});

	it("ships no browser JavaScript on prerendered static pages except contact", () => {
		for (const route of prerenderedRoutes) {
			if (clientJavaScriptRoutes.has(route)) continue;

			for (const script of inlineScriptsIn(htmlFor(route))) {
				// The homepage's WebMCP registration is the one exception, and it
				// only counts as "no JavaScript" because nothing in it runs: the
				// whole body is inside a feature check no normal browser passes.
				const isWebMcp = route === "/" && script.body.includes("navigator.modelContext");

				expect({
					route,
					allowed: script.tag.includes('type="application/ld+json"') || isWebMcp,
				}).toEqual({ route, allowed: true });
			}
		}
	});

	it("registers WebMCP tools on the homepage, inert in every normal browser", () => {
		const script = scriptContaining(htmlFor("/"), "navigator.modelContext");

		expect(script).toBeDefined();
		// Small, self-contained, and guarded — asserted on the bytes that shipped
		// rather than on the generator, because Astro could have transformed them.
		expect(new TextEncoder().encode(script).byteLength).toBeLessThanOrEqual(2048);
		expect(script?.trimStart().startsWith("try{")).toBe(true);
		expect(script?.trimEnd().endsWith("}catch(e){}")).toBe(true);
		expect(script?.slice(0, script.indexOf("if(")).trim()).toBe("try{");
		expect(script).not.toMatch(/https?:\/\//);
		expect(script).not.toMatch(/\bsrc=/);

		for (const tool of WEB_MCP_TOOL_NAMES) {
			expect(script).toContain(`"${tool}"`);
		}
	});

	it("keeps the WebMCP script off every page but the homepage", () => {
		// It buys nothing on a services page and would put bytes on responses an
		// agentic browser never lands on first.
		for (const route of prerenderedRoutes) {
			if (route === "/") continue;

			expect({ route, hasWebMcp: htmlFor(route).includes("modelContext") }).toEqual({
				route,
				hasWebMcp: false,
			});
		}
	});

	it("loads the Turnstile widget script only on contact", () => {
		for (const route of prerenderedRoutes) {
			const html = htmlFor(route);

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
		const html = htmlFor("/contact");

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
		expect(sitemapFileNames()).toEqual(["sitemap.xml"]);
	});

	it("301s the retired sitemap URLs to the one that replaced them", () => {
		// `@astrojs/sitemap` served these on auditmos.com before the sitemap was
		// unified, so they must not start 404ing.
		expect(redirectRules()).toContainEqual(["/sitemap-index.xml", "/sitemap.xml", "301"]);
		expect(redirectRules()).toContainEqual(["/sitemap-0.xml", "/sitemap.xml", "301"]);
	});

	it("301s the retired /projects URLs to the /work paths that replaced them", () => {
		// These were indexed, sitemapped, and handed to agents as `.md` URLs in
		// `/llms.txt` and the MCP tool output before the rename.
		expect(redirectRules()).toContainEqual(["/projects", "/work", "301"]);
		expect(redirectRules()).toContainEqual(["/projects.md", "/work.md", "301"]);
		// The splat covers the detail pages and their `.md` twins alike, which
		// is why these three rules are hand-written in `public/_redirects`
		// rather than declared in astro.config — see the comment there.
		expect(redirectRules()).toContainEqual(["/projects/*", "/work/:splat", "301"]);
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

	it("keeps the CSP report sink a rendered route, not a prerendered asset", () => {
		// A `prerender = true` slipped onto this route would not break the build:
		// it would emit a static file, every violation report would be answered
		// by the asset server, and the sink would go quiet. Silence is exactly
		// what "safe to enforce" looks like, so the failure mode is flipping
		// `CSP_MODE` on evidence that was never collected.
		expect(astroOnDemandRoutePatterns()).toContain(CSP_REPORT_PATH);
	});

	it("routes every prerendered page through the Worker so Accept can be negotiated", () => {
		const patterns = deployedAssetsConfig().run_worker_first ?? [];

		// The asset server would otherwise answer these before the Worker runs,
		// and `Accept: text/markdown` would never be looked at.
		for (const route of astroBuildPageRoutePatterns()) {
			const path = route === "/work/[slug]" ? sampleProjectRoutes[0] : route;

			expect({ path, negotiable: claimsPath(patterns, path) }).toEqual({ path, negotiable: true });
		}
	});

	it("routes the trailing-slash form of every page through the Worker too", () => {
		// `run_worker_first` matches paths literally, so `/about` leaves `/about/`
		// to the asset server, which answers it with `html_handling`'s **307**.
		// Only a 301 consolidates ranking signals onto the canonical URL, which is
		// the entire reason `canonicalRedirect()` exists — and it never runs for a
		// request that does not reach the Worker. Issue #38.
		const patterns = deployedAssetsConfig().run_worker_first ?? [];

		for (const route of astroBuildPageRoutePatterns()) {
			// The root is canonical *with* its slash, so it has no second form.
			if (route === "/") continue;

			const path = route === "/work/[slug]" ? sampleProjectRoutes[0] : route;

			expect({ path: `${path}/`, negotiable: claimsPath(patterns, `${path}/`) }).toEqual({
				path: `${path}/`,
				negotiable: true,
			});
		}
	});

	it("bundles the canonical trailing-slash redirect into the deployed Worker entry", () => {
		// `html_handling` above only governs requests the asset server answers,
		// and `run_worker_first` claims every page route before it — including the
		// `/work/*` wildcard. This redirect is the only thing stopping
		// `/work/<slug>/` from being a second reachable URL for the same page.
		expect(workerEntrySource()).toContain("max-age=3600");
	});

	it("bundles the security header layer into the deployed Worker entry", () => {
		// `_headers` stops at the asset server, so the routes the Worker renders
		// itself — /api/contact, /mcp, both OAuth endpoints — would ship bare
		// without this. Measured on production 11 Aug 2026: /llms.txt carried the
		// `_headers` rules, /mcp and /api/contact carried none.
		expect(workerEntrySource()).toContain("X-XSS-Protection");
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
			if (route === "/work/[slug]") continue;
			expect(configuredStaticRoutes.has(route)).toBe(true);
		}
	});

	it("prerenders markdown mirrors and llms.txt entries for every generated HTML page", () => {
		const llmsTxt = assetText("llms.txt");

		for (const route of generatedHtmlRoutes()) {
			const markdownPath = markdownTwinPathFor(route);

			expect({ route, generated: assetExists(markdownPath) }).toEqual({ route, generated: true });
			expect(assetText(markdownPath)).toMatch(/^# /);
			expect(llmsTxt).toContain(`https://auditmos.com${markdownPath}`);
		}
	});

	it("emits no analytics beacon of its own — the edge injects the only one", () => {
		// Cloudflare injects the Web Analytics beacon after the Worker returns
		// (#39). A tag emitted here would not replace that one, it would be a
		// second beacon, and every pageview would be counted twice while the
		// numbers still looked plausible. The wire-side half of this guard is
		// `pnpm agents:verify`, which fails on zero beacons *or* duplicates;
		// this half fails the build before it can ship a duplicate.
		for (const route of generatedHtmlRoutes()) {
			expect({ route, beacons: htmlFor(route).includes("cloudflareinsights.com") }).toEqual({
				route,
				beacons: false,
			});
		}
	});

	it("ships a CSS rule for every class the built HTML actually uses", () => {
		// `globals.css` narrows Tailwind to `.astro` sources so plain TypeScript
		// tokens stop generating dead utilities. This is the safety net for that:
		// narrowing must never drop a class the markup depends on.
		const { usedClassCount, missing } = cssCoverage();

		expect(usedClassCount).toBeGreaterThan(100);
		expect(missing).toEqual([]);
	});

	it("serves the MCP Server Card at both its reserved and well-known locations", () => {
		const cards = SERVER_CARD_PATHS.map((path) => assetJson(path));

		// One document, two URLs — a client following the catalog and a scanner
		// following convention must not get different answers.
		expect(cards).toHaveLength(2);
		expect(cards[0]).toEqual(cards[1]);
		expect(cards[0]).toMatchObject({ name: expect.stringContaining("/") as unknown as string });
	});

	it("points the AI catalog at a Server Card the build actually generated", () => {
		const catalog = assetJson<{ entries: { url: string }[] }>(AI_CATALOG_PATH);

		for (const entry of catalog.entries) {
			const path = new URL(entry.url).pathname;

			expect({ url: entry.url, generated: assetExists(path) }).toEqual({
				url: entry.url,
				generated: true,
			});
		}
	});

	it("serves an RFC 9727 API catalog whose every link is a file the build produced", () => {
		const catalog = assetJson<{ linkset: Record<string, string | { href: string }[]>[] }>(
			API_CATALOG_PATH,
		);
		const hrefs = catalog.linkset
			.flatMap((context) => Object.entries(context))
			.filter(([relation]) => relation !== "anchor")
			.flatMap(([, links]) => (Array.isArray(links) ? links : []))
			.map((link) => new URL(link.href).pathname);

		// A catalog that names a document the build never generated is worse than
		// no catalog: it sends an agent to a 404 with the site's authority.
		expect(hrefs).toHaveLength(agentSurfaces.length);
		expect(hrefs.filter((path) => !buildArtifactExists(path))).toEqual([]);
	});

	it("serves the OAuth authorization server metadata byte-identically at both paths", () => {
		const documents = OAUTH_AUTHORIZATION_SERVER_PATHS.map((path) => assetText(path));

		// One server, two conventional paths. A client that probes the OpenID
		// path and one that probes the OAuth path must not learn different
		// things — compared as bytes, not as parsed JSON, so key order counts.
		expect(documents).toHaveLength(2);
		expect(documents[0]).toBe(documents[1]);
		expect(JSON.parse(documents[0])).toMatchObject({
			issuer: "https://auditmos.com",
			grant_types_supported: ["client_credentials"],
		});
	});

	it("answers the bare protected-resource path by sending clients to the derived one", () => {
		// Two audiences, one document. A client that derives the URL by RFC 9728
		// §3.1 asks for `…/oauth-protected-resource/mcp`; MCP clients and the
		// readiness scanners ask for the bare path. The derived path holds the
		// file — a file and a directory cannot share a name in the build output —
		// so the bare path redirects to it rather than 404ing.
		expect(redirectRules()).toContainEqual([
			"/.well-known/oauth-protected-resource",
			OAUTH_PROTECTED_RESOURCE_PATH,
			"302",
		]);
	});

	it("names /mcp as the protected resource, with this site as its issuer", () => {
		const metadata = assetJson<{ resource: string; authorization_servers: string[] }>(
			OAUTH_PROTECTED_RESOURCE_PATH,
		);

		expect(metadata.resource).toBe("https://auditmos.com/mcp");
		expect(metadata.authorization_servers).toEqual(["https://auditmos.com"]);
	});

	it("attests every SKILL.md with a digest recomputed from the bytes it shipped", () => {
		const index = assetJson<{
			$schema: string;
			skills: { name: string; url: string; digest: string }[];
		}>(AGENT_SKILLS_INDEX_PATH);

		expect(index.$schema).toContain("discovery/0.2.0");
		expect(index.skills.length).toBeGreaterThan(0);

		for (const skill of index.skills) {
			// The whole discipline in one assertion: hash what was actually
			// written, not what the generator believes it wrote. Editing a skill
			// without the digest following now fails here instead of shipping an
			// index that attests to bytes nobody serves.
			expect({ name: skill.name, served: assetExists(skill.url) }).toEqual({
				name: skill.name,
				served: true,
			});
			expect({ name: skill.name, digest: skill.digest }).toEqual({
				name: skill.name,
				digest: `sha256:${assetSha256(skill.url)}`,
			});
		}
	});

	it("serves an A2A card whose skills the MCP server actually implements", () => {
		const card = assetJson<{ name: string; version: string; skills: { id: string }[] }>(
			A2A_AGENT_CARD_PATH,
		);
		const agentIndex = assetJson<{ agents: { tools: { name: string }[] }[] }>("agents.json");
		const served = new Set(agentIndex.agents[0]?.tools.map((tool) => tool.name) ?? []);

		// Compared against the built `/agents.json`, not against the registry the
		// card was generated from: this is the check that the two documents the
		// site actually ships agree about what the server can do.
		expect(card.skills.length).toBeGreaterThan(0);
		expect(card.skills.filter((skill) => !served.has(skill.id))).toEqual([]);
		expect(card.name).toBe("Auditmos");
		expect(card.version).not.toBe("");
	});

	it("serves /auth.md as markdown, with every URL it names resolving in the build", () => {
		const markdown = assetText(AUTH_DOC_PATH);
		const paths = [...markdown.matchAll(/https:\/\/auditmos\.com(\/[^\s`)"']*)/g)]
			.map((match) => match[1])
			.filter((path) => path !== "/");

		// The page an agent reads to learn how to authenticate is the worst place
		// for a dead link: it would send a client that is already confused to a
		// 404 with the site's authority behind it. `/oauth/*` and `/mcp` resolve
		// as on-demand routes rather than files, so both are accepted.
		const onDemand = astroOnDemandRoutePatterns();

		expect(paths.length).toBeGreaterThan(5);
		expect(paths.filter((path) => !buildArtifactExists(path) && !onDemand.has(path))).toEqual([]);
		expect(headerRuleBlocks().get(AUTH_DOC_PATH)).toContain(
			"Content-Type: text/markdown; charset=utf-8",
		);
	});

	// Only anonymised work ships right now, so the named-client branch of the
	// detail page (`client.name` with its optional link) has no build-level
	// coverage — `getClientDisplay` unit tests cover the logic itself. Add the
	// named case back here as soon as a named project is published again.
	it("renders the sample project detail page with its client context and CTA", () => {
		const anonymisedHtml = htmlFor("/work/client-owned-gpu-fleet-crm");

		expect(anonymisedHtml).toContain("Distributed GPU compute");
		expect(anonymisedHtml).toContain("Auditmos OÜ");
		expect(anonymisedHtml).toContain("Discuss it with Auditmos");
	});
});
