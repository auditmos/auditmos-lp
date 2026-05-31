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
const clientJavaScriptRoutes = new Set<string>(["/contact"]);

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

function workerEntrySource(): string {
	const chunksDir = resolve(root, "dist", "server", "chunks");
	const workerEntry = readdirSync(chunksDir).find(
		(file) => file.startsWith("worker-entry_") && file.endsWith(".mjs"),
	);

	if (!workerEntry) {
		throw new Error("No Cloudflare worker entry chunk found in build output");
	}

	return readFileSync(resolve(chunksDir, workerEntry), "utf8");
}

function astroBuildPageRoutePatterns(): string[] {
	const source = workerEntrySource();
	const marker = "const _manifest = deserializeManifest(";
	const start = source.indexOf(marker);

	if (start === -1) {
		throw new Error("No serialized Astro manifest found in worker entry");
	}

	const jsonStart = start + marker.length;
	const jsonEnd = source.indexOf(");\n", jsonStart);
	const manifest = JSON.parse(source.slice(jsonStart, jsonEnd)) as {
		routes: {
			routeData: {
				origin: string;
				params: string[];
				prerender: boolean;
				route: string;
				type: string;
			};
		}[];
	};

	return manifest.routes
		.map((route) => route.routeData)
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

function walkFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const file = resolve(dir, entry);
		return statSync(file).isDirectory() ? walkFiles(file) : [file];
	});
}

function routeFromHtmlFile(file: string): string {
	const relativePath = file.slice(distClient.length + 1);
	if (relativePath === "index.html") return "/";
	if (relativePath.endsWith("/index.html"))
		return `/${relativePath.slice(0, -"/index.html".length)}`;
	return `/${relativePath.slice(0, -".html".length)}`;
}

function generatedHtmlRoutes(): string[] {
	return walkFiles(distClient)
		.filter((file) => file.endsWith(".html"))
		.map(routeFromHtmlFile)
		.sort();
}

function markdownPathForRoute(route: string): string {
	if (route === "/") return resolve(distClient, "index.md");
	return resolve(distClient, `${route.slice(1)}.md`);
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
			if (clientJavaScriptRoutes.has(route)) continue;
			expect(pageTransferSize(htmlPathFor(route))).toBeLessThanOrEqual(maxTransferredBytes);
		}
	});

	it("ships no browser JavaScript on prerendered static pages except contact", () => {
		for (const route of prerenderedRoutes) {
			if (clientJavaScriptRoutes.has(route)) continue;
			const html = readFileSync(htmlPathFor(route), "utf8");
			const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);

			expect(scripts.every((script) => script.includes('type="application/ld+json"'))).toBe(true);
		}
	});

	it("loads the Turnstile widget script only on contact", () => {
		for (const route of prerenderedRoutes) {
			const html = readFileSync(htmlPathFor(route), "utf8");

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
		const html = readFileSync(htmlPathFor("/contact"), "utf8");

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

	it("keeps the MD mirror registry aligned with Astro's prerendered page route list", () => {
		const configuredStaticRoutes = new Set<string>(staticPages.map((page) => page.path));

		for (const route of astroBuildPageRoutePatterns()) {
			if (route === "/projects/[slug]") continue;
			expect(configuredStaticRoutes.has(route)).toBe(true);
		}
	});

	it("prerenders markdown mirrors and llms.txt entries for every generated HTML page", () => {
		const llmsTxt = readFileSync(resolve(distClient, "llms.txt"), "utf8");

		for (const route of generatedHtmlRoutes()) {
			const markdownPath = route === "/" ? "/index.md" : `${route}.md`;

			expect(existsSync(markdownPathForRoute(route))).toBe(true);
			expect(readFileSync(markdownPathForRoute(route), "utf8")).toMatch(/^# /);
			expect(llmsTxt).toContain(`https://auditmos.com${markdownPath}`);
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
