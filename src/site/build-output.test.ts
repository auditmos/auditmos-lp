import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execa } from "execa";
import { staticPages } from "./pages";

const root = resolve(import.meta.dirname, "..", "..");
const distClient = resolve(root, "dist", "client");
const maxTransferredBytes = 50 * 1024;
const sampleProjectRoutes = [
	"/projects/auditmos-website-rebuild",
	"/projects/regulated-platform-security-review",
] as const;
const prerenderedRoutes = [
	...staticPages.map((page) => page.path),
	...sampleProjectRoutes,
] as const;

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
			expect(pageTransferSize(htmlPathFor(route))).toBeLessThanOrEqual(maxTransferredBytes);
		}
	});

	it("ships no browser JavaScript on prerendered static pages", () => {
		for (const route of prerenderedRoutes) {
			const html = readFileSync(htmlPathFor(route), "utf8");
			const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);

			expect(scripts.every((script) => script.includes('type="application/ld+json"'))).toBe(true);
		}
	});

	it("lists every static route and sample project route in the generated sitemap", () => {
		const sitemapSource = generatedSitemapSource();

		for (const route of prerenderedRoutes) {
			expect(sitemapSource).toContain(`https://auditmos.com${route}`);
		}
	});

	it("serves the advertised sitemap.xml path with every static route and sample project route", () => {
		const advertisedSitemap = readFileSync(resolve(distClient, "sitemap.xml"), "utf8");

		for (const route of prerenderedRoutes) {
			expect(advertisedSitemap).toContain(`https://auditmos.com${route}`);
		}
	});

	it("renders both named-client and anonymised-sector sample project detail pages", () => {
		const namedClientHtml = readFileSync(htmlPathFor("/projects/auditmos-website-rebuild"), "utf8");
		const anonymisedHtml = readFileSync(
			htmlPathFor("/projects/regulated-platform-security-review"),
			"utf8",
		);

		expect(namedClientHtml).toContain("Auditmos OÜ");
		expect(namedClientHtml).toContain("Contact us about this");
		expect(anonymisedHtml).toContain("Banking");
		expect(anonymisedHtml).toContain("Contact us about this");
	});
});
