/** Browser-script and interactive-control contracts over the emitted site. */

import { WEB_MCP_TOOL_NAMES } from "@/agents/web-mcp";
import { renderThemeScript } from "@/brand/theme";
import { buildRunCount } from "./build-once";
import { buildSite, htmlFor, inlineScriptsIn, scriptContaining } from "./build-output";
import { staticPages } from "./pages";

const sampleProjectRoutes = ["/work/client-owned-gpu-fleet-crm", "/work/wizytowka-link"] as const;
const prerenderedRoutes = [
	...staticPages.map((page) => page.path),
	...sampleProjectRoutes,
] as const;
const pagesWithAdditionalClientJavaScript = new Set<string>(["/contact"]);

describe("static build browser scripts", () => {
	beforeAll(async () => {
		await buildSite();
	}, 180_000);

	it("shares the one production build with the rest of the suite", () => {
		expect(buildRunCount()).toBe(1);
	});

	it("ships the accessible three-state theme control before page content paints", () => {
		/*
		 * Assumptions this public-output test encodes:
		 * - System is the default and the only fallback for absent/invalid storage.
		 * - Light and Dark are explicit browser-local overrides.
		 * - Every HTML page exposes the same natively labelled select.
		 * Browser interaction and computed colours are verified separately in a
		 * real browser; this test intentionally does not mock DOM APIs.
		 */
		const themeScript = renderThemeScript();
		expect(new TextEncoder().encode(themeScript).byteLength).toBeLessThanOrEqual(768);

		for (const route of prerenderedRoutes) {
			const html = htmlFor(route);
			const headEnd = html.indexOf("</head>");
			const scriptStart = html.indexOf(themeScript);
			const themeControl = html.indexOf('id="theme-select"');

			expect({ route, theme: html.match(/<html[^>]+data-theme="([^"]+)"/)?.[1] }).toEqual({
				route,
				theme: "system",
			});
			expect(html).toMatch(/<label\b[^>]*\bfor="theme-select"/);
			expect(html).toMatch(/<select\b[^>]*\bid="theme-select"/);
			expect(html).toContain('<option value="system" selected>◐ System</option>');
			expect(html).toContain('<option value="light">☀ Light</option>');
			expect(html).toContain('<option value="dark">☾ Dark</option>');
			expect({
				route,
				themeIsFinalHeaderUtility:
					themeControl > html.indexOf('aria-label="Primary navigation"') &&
					themeControl > html.indexOf('aria-label="Mobile navigation"'),
			}).toEqual({ route, themeIsFinalHeaderUtility: true });
			expect({ route, scriptRunsInHead: scriptStart >= 0 && scriptStart < headEnd }).toEqual({
				route,
				scriptRunsInHead: true,
			});
		}
	});

	it("ships only the theme controller and declared page-specific browser scripts", () => {
		const themeScript = renderThemeScript();

		for (const route of prerenderedRoutes) {
			if (pagesWithAdditionalClientJavaScript.has(route)) continue;

			for (const script of inlineScriptsIn(htmlFor(route))) {
				// The homepage's WebMCP registration is the other exception, and it
				// only counts as "no JavaScript" because nothing in it runs: the
				// whole body is inside a feature check no normal browser passes.
				const isWebMcp = route === "/" && script.body.includes("navigator.modelContext");
				const isThemeController = script.body === themeScript;

				expect({
					route,
					allowed:
						script.tag.includes('type="application/ld+json"') || isThemeController || isWebMcp,
				}).toEqual({ route, allowed: true });
			}
		}
	});

	it("registers WebMCP tools on the homepage, inert in every normal browser", () => {
		const script = scriptContaining(htmlFor("/"), "navigator.modelContext");

		expect(script).toBeDefined();
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
});
