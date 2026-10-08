/** Integration tests: real HTTP through `astro preview`, including the asset router. */
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { execa, execaSync } from "execa";
import { buildRunCount } from "./build-once";
import { buildSite, generatedHtmlRoutes, htmlFor } from "./build-output";

const slack = "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)";
const otherClients = [
	"Mozilla/5.0",
	"Twitterbot/1.0",
	"facebookexternalhit/1.1",
	"LinkedInBot",
	"Slack-ImgProxy",
	"NotSlackbot-LinkExpanding",
	"",
];
let server: ReturnType<typeof execa>;
let origin: string;

function imageMeta(html: string, key: string): string | undefined {
	return html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]+)"`))?.[1];
}

function withoutImages(html: string): string {
	return html.replace(
		/<meta (?:property|name)="(?:og:image(?::width|:height)?|twitter:image)"[^>]*>/g,
		"",
	);
}

async function page(
	path: string,
	userAgent: string,
	headers: Record<string, string> = {},
	method = "GET",
): Promise<Response> {
	return fetch(`${origin}${path}`, {
		method,
		headers: { Accept: "text/html", "User-Agent": userAgent, ...headers },
		redirect: "manual",
	});
}

/** Every process below `pid` — under `astro preview`, its `esbuild` and `workerd`. */
function processTree(pid: number): number[] {
	const pairs = execaSync("ps", ["-A", "-o", "pid=,ppid="])
		.stdout.trim()
		.split("\n")
		.map((line) => line.trim().split(/\s+/).map(Number));
	const below = (parent: number): number[] =>
		pairs.flatMap(([child, ppid]) =>
			child !== undefined && ppid === parent ? [child, ...below(child)] : [],
		);
	return below(pid);
}

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/** The processes still running after `withinMs`, named so a failure says what leaked. */
async function survivors(pids: number[], withinMs: number): Promise<string[]> {
	const deadline = Date.now() + withinMs;
	let alive = pids.filter(isAlive);
	while (alive.length > 0 && Date.now() < deadline) {
		await delay(100);
		alive = alive.filter(isAlive);
	}
	return alive.map(
		(pid) =>
			`${pid} ${execaSync("ps", ["-o", "comm=", "-p", String(pid)], { reject: false }).stdout}`,
	);
}

// SIGINT, like Ctrl-C: it stops `astro preview` with its esbuild and workerd, and
// unlike SIGTERM it also stopped previews left orphaned by an earlier run.
async function stopPreview(): Promise<void> {
	server?.kill("SIGINT");
	await server;
}

describe("Slack preview over HTTP", () => {
	beforeAll(async () => {
		await buildSite();
		// Astro 7 auto-backgrounds in agent sessions; keep this process owned by
		// the test and isolated from any developer's running preview daemon.
		// Spawned directly, not via `pnpm preview`: pnpm does not forward signals
		// to the script it runs, so the server could never be stopped.
		server = execa("astro", ["preview", "--ignore-lock", "--host", "127.0.0.1", "--port", "0"], {
			env: { NO_COLOR: "1" },
			preferLocal: true,
			reject: false,
		});
		origin = await new Promise<string>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error("Preview did not start within 30 seconds")),
				30_000,
			);
			server.stdout?.on("data", (chunk: Buffer) => {
				const url = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
				if (url) {
					clearTimeout(timer);
					resolve(url);
				}
			});
			void server.then(() => {
				clearTimeout(timer);
				reject(new Error("Preview exited before startup"));
			});
		});
	}, 180_000);

	afterAll(async () => {
		await stopPreview();
	});

	it("shares the production build", () => expect(buildRunCount()).toBe(1));

	it("changes only the four image fields for Slack on every built page", async () => {
		for (const route of generatedHtmlRoutes()) {
			const source = htmlFor(route);
			if (!source.includes('property="og:image"')) continue;
			const response = await page(route, slack);
			const html = await response.text();
			expect(response.status, route).toBe(200);
			expect(imageMeta(html, "og:image"), route).toMatch(
				/^https:\/\/auditmos\.com\/og-slack\.png\?v=[a-f0-9]{12}$/,
			);
			expect(imageMeta(html, "twitter:image")).toBe(imageMeta(html, "og:image"));
			expect(imageMeta(html, "og:image:width")).toBe("800");
			expect(imageMeta(html, "og:image:height")).toBe("800");
			expect(withoutImages(html), route).toBe(withoutImages(source));
		}
	});

	it("preserves the complete HTML for other clients, even between Slack requests", async () => {
		for (const route of ["/", "/about", "/work/wizytowka-link"]) {
			for (const ua of otherClients) {
				await (await page(route, slack)).text();
				const response = await page(route, ua);
				expect(await response.text(), `${route}: ${ua}`).toBe(htmlFor(route));
			}
		}
	});

	it("forbids caching either HTML variant, preserves Accept variance and strips Slack validators", async () => {
		for (const ua of [slack, ...otherClients]) {
			const response = await page("/about", ua);
			for (const header of ["Cache-Control", "CDN-Cache-Control", "Cloudflare-CDN-Cache-Control"]) {
				expect(response.headers.get(header), `${ua}: ${header}`).toContain("no-store");
			}
			expect(response.headers.get("Vary")).toMatch(/Accept/i);
			expect(response.headers.get("Vary")).toMatch(/User-Agent/i);
			if (ua === slack) {
				for (const header of ["ETag", "Last-Modified", "Content-Length"])
					expect(response.headers.has(header), header).toBe(false);
			}
			await response.text();
		}
	});

	it("never lets an asset validator or Range suppress Slack's rewritten HTML", async () => {
		const conditions: Record<string, string>[] = [
			{ "If-None-Match": "*" },
			{ "If-Modified-Since": "Wed, 01 Jan 2031 00:00:00 GMT" },
			{ Range: "bytes=0-99" },
		];
		for (const headers of conditions) {
			const response = await page("/about", slack, headers);
			expect(response.status).toBe(200);
			expect(imageMeta(await response.text(), "og:image:width")).toBe("800");
		}
	});

	it("keeps HEAD bodyless, canonical redirects and markdown negotiation intact", async () => {
		const head = await page("/about", slack, {}, "HEAD");
		expect(head.status).toBe(200);
		expect(head.headers.get("Cache-Control")).toContain("no-store");
		expect(await head.text()).toBe("");
		const redirect = await page("/about/", slack);
		expect(redirect.status).toBe(301);
		expect(new URL(redirect.headers.get("Location") ?? "", origin).pathname).toBe("/about");
		const markdown = await page("/about", slack, { Accept: "text/markdown" });
		expect(markdown.headers.get("Content-Type")).toContain("text/markdown");
		expect(await markdown.text()).toBe(await (await fetch(`${origin}/about.md`)).text());
	});

	it("serves the versioned square PNG while keeping the wide image byte-identical", async () => {
		const html = await (await page("/", slack)).text();
		const url = new URL(imageMeta(html, "og:image") ?? "https://invalid.test/");
		const response = await fetch(`${origin}${url.pathname}${url.search}`);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("image/png");
		const png = Buffer.from(await response.arrayBuffer());
		expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
		expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([800, 800]);
		expect(createHash("sha256").update(png).digest("hex").slice(0, 12)).toBe(
			url.searchParams.get("v"),
		);
		const wide = Buffer.from(await (await fetch(`${origin}/og.png`)).arrayBuffer());
		expect([wide.readUInt32BE(16), wide.readUInt32BE(20)]).toEqual([1200, 630]);
		expect(createHash("sha256").update(wide).digest("hex").slice(0, 12)).toBe("5faba9e50d91");
	});

	// Last on purpose: it shuts down the server every test above uses, and tests
	// in a file run in order. Not awaited — a teardown that hangs must still let
	// the assertion report which processes it left behind.
	it("stops the preview server and every process it started", async () => {
		const root = server.pid;
		expect(root).toBeTypeOf("number");
		const pids = root === undefined ? [] : [root, ...processTree(root)];

		void stopPreview();

		expect(await survivors(pids, 10_000)).toEqual([]);
	}, 20_000);
});
