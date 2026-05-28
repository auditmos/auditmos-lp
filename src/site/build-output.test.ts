import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execa } from "execa";
import { phaseTwoPages } from "./pages";

const root = resolve(import.meta.dirname, "..", "..");
const distClient = resolve(root, "dist", "client");
const maxTransferredBytes = 50 * 1024;

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

describe("Phase 2 build output", () => {
	beforeAll(async () => {
		await execa("pnpm", ["build"], { cwd: root });
	}, 120_000);

	it("prerenders every Phase 2 route", () => {
		for (const page of phaseTwoPages) {
			expect(htmlPathFor(page.path)).toBeTruthy();
		}
	});

	it("keeps each prerendered static page within the 50 KB HTML plus CSS budget", () => {
		for (const page of phaseTwoPages) {
			expect(pageTransferSize(htmlPathFor(page.path))).toBeLessThanOrEqual(maxTransferredBytes);
		}
	});

	it("ships no browser JavaScript on the Phase 2 static pages", () => {
		for (const page of phaseTwoPages) {
			const html = readFileSync(htmlPathFor(page.path), "utf8");
			const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);

			expect(scripts.every((script) => script.includes('type="application/ld+json"'))).toBe(true);
		}
	});

	it("lists every Phase 2 route in the generated sitemap", () => {
		const sitemapSource = generatedSitemapSource();

		for (const page of phaseTwoPages) {
			expect(sitemapSource).toContain(`https://auditmos.com${page.path}`);
		}
	});

	it("serves the advertised sitemap.xml path with every Phase 2 route", () => {
		const advertisedSitemap = readFileSync(resolve(distClient, "sitemap.xml"), "utf8");

		for (const page of phaseTwoPages) {
			expect(advertisedSitemap).toContain(`https://auditmos.com${page.path}`);
		}
	});
});
