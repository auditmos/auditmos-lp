import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONTENT_SIGNAL } from "./discovery-headers";

const root = resolve(import.meta.dirname, "..", "..");
const astroConfigSource = readFileSync(resolve(root, "astro.config.mjs"), "utf8");
const robotsPath = resolve(root, "public", "robots.txt");
const robotsSource = existsSync(robotsPath) ? readFileSync(robotsPath, "utf8") : "";

describe("crawler configuration", () => {
	it("owns the sitemap in a single endpoint, at the path robots.txt advertises", () => {
		// `@astrojs/sitemap` emits a competing `/sitemap-index.xml` from a second
		// enumeration of the routes, so the endpoint is the only generator.
		expect(existsSync(resolve(root, "src", "pages", "sitemap.xml.ts"))).toBe(true);
		expect(astroConfigSource).not.toContain("sitemap(");
		expect(astroConfigSource).toContain('site: "https://auditmos.com"');
	});

	it("allows crawlers and points them at the sitemap and llms index", () => {
		expect(robotsSource).toContain("User-agent: *");
		expect(robotsSource).toContain("Allow: /");
		expect(robotsSource).toContain("Sitemap: https://auditmos.com/sitemap.xml");
		expect(robotsSource).toContain("LLMs: https://auditmos.com/llms.txt");
	});

	it("declares a Content Signal for each of the three defined uses", () => {
		// An omitted signal reads as "neither granted nor restricted", which is a
		// weaker statement than a deliberate no — so all three are always present.
		expect(robotsSource).toContain("Content-Signal: ai-train=no, search=yes, ai-input=yes");
	});

	it("states the same policy in robots.txt as the response header does", () => {
		// The two surfaces are authored separately — a static file and a build
		// integration. A site declaring two different policies has declared none,
		// so they are pinned to each other here.
		expect(robotsSource).toContain(`Content-Signal: ${CONTENT_SIGNAL}`);
	});

	it("keeps Content-Signal inside the User-agent group it applies to", () => {
		// Content-Signal is a group member like Allow/Disallow. Placed after a
		// non-group directive such as Sitemap, it falls outside the group and
		// parsers are entitled to ignore it.
		const lines = robotsSource
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"));
		const groupStart = lines.findIndex((line) => line.toLowerCase().startsWith("user-agent:"));
		const signal = lines.findIndex((line) => line.toLowerCase().startsWith("content-signal:"));
		const firstNonGroup = lines.findIndex((line) => /^(sitemap|llms):/i.test(line));

		expect(groupStart).toBeGreaterThanOrEqual(0);
		expect(signal).toBeGreaterThan(groupStart);
		expect(signal).toBeLessThan(firstNonGroup);
	});
});
