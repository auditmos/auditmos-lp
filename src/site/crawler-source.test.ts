import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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
});
