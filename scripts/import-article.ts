#!/usr/bin/env tsx
import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
	type ArticleDefaults,
	ArticleImportError,
	type ArticleSource,
	articleDefaults,
	buildProjectMarkdown,
	nextProjectOrder,
	type ProjectClient,
	parseArticle,
	parseProjectCapabilities,
	parseProjectProvenance,
	projectFilePath,
	projectOrder,
	resolveArticlePath,
} from "./import-article-lib";

/**
 * Publishes an externally authored launch article to `/work`: asks for the
 * article path, year, client and industry, derives title, slug, summary and
 * tags from the article itself, and writes the `projects` collection entry that
 * `/work`, `/work/<slug>` and their markdown twins are all built from.
 *
 * Every prompted value also has a flag, so the same import can run
 * non-interactively (an agent, or a re-import after editing the article).
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS_DIR = path.join(ROOT, "src", "content", "projects");
const CURRENT_YEAR = new Date().getFullYear();
const MAX_PATH_ATTEMPTS = 5;
/** Above this a summary is too long for a meta description and worth flagging. */
const SUMMARY_WARN_CHARS = 200;

const OPTIONS = {
	"dry-run": { type: "boolean", default: false },
	yes: { type: "boolean", default: false },
	help: { type: "boolean", default: false },
	year: { type: "string" },
	client: { type: "string" },
	"client-url": { type: "string" },
	sector: { type: "string" },
	industry: { type: "string" },
	provenance: { type: "string" },
	capabilities: { type: "string" },
} as const;

function usage(): string {
	return [
		'Usage: pnpm import-article ["<path to article.md>"] [flags]',
		"",
		"Prompts for anything not passed as a flag. Title, slug, summary and tags",
		"come from the article itself.",
		"",
		"  --year <n>          Project year (default: the article's own year)",
		"  --client <name>     Named client; omit together with --sector to be asked",
		"  --client-url <url>  Client URL, only valid with --client",
		"  --sector <label>    Anonymised client sector instead of a name",
		"  --industry <label>  Industry label; pass an empty string to omit it",
		"  --provenance <type> client-work (default) or internal-r-and-d",
		"  --capabilities <csv> One or more of: software, security, applied-r-and-d",
		"  --dry-run           Print the generated file instead of writing it",
		"  --yes               Skip the write confirmation",
	].join("\n");
}

/** Lazily opened, so a fully flagged run never touches stdin. */
class PromptSession {
	#rl: readline.Interface | undefined;

	async line(prompt: string): Promise<string> {
		this.#rl ??= readline.createInterface({ input: process.stdin, output: process.stdout });
		const rl = this.#rl;
		// Without this, an ended stdin (piped input, closed terminal) leaves the
		// question pending forever instead of failing.
		const controller = new AbortController();
		const abort = () => controller.abort();
		rl.once("close", abort);

		try {
			return await rl.question(prompt, { signal: controller.signal });
		} catch {
			throw new ArticleImportError(
				"Input ended before every answer was given — pass the missing values as flags instead (pnpm import-article --help).",
			);
		} finally {
			rl.off("close", abort);
		}
	}

	close(): void {
		this.#rl?.close();
	}
}

async function ask(session: PromptSession, question: string, fallback = ""): Promise<string> {
	const answer = (await session.line(`${question}${fallback ? ` [${fallback}]` : ""}: `)).trim();
	if (answer === "-") return "";
	return answer.length > 0 ? answer : fallback;
}

async function askRequired(
	session: PromptSession,
	question: string,
	fallback = "",
): Promise<string> {
	for (;;) {
		const answer = await ask(session, question, fallback);
		if (answer) return answer;
		console.error("  This one is required.");
	}
}

function parseYear(answer: string): number | undefined {
	const year = Number.parseInt(answer, 10);
	const valid = Number.isInteger(year) && year >= 2000 && year <= CURRENT_YEAR + 1;
	return valid ? year : undefined;
}

async function askYear(
	session: PromptSession,
	fallback: number,
	preset: string | undefined,
): Promise<number> {
	const range = `between 2000 and ${CURRENT_YEAR + 1}`;

	if (preset !== undefined) {
		const year = parseYear(preset);
		if (year === undefined) throw new ArticleImportError(`--year must be a year ${range}.`);
		return year;
	}

	for (;;) {
		const year = parseYear(await ask(session, "Year", String(fallback)));
		if (year !== undefined) return year;
		console.error(`  Enter a year ${range}.`);
	}
}

function parseHttpUrl(answer: string): string | undefined {
	try {
		const url = new URL(answer);
		return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
	} catch {
		return undefined;
	}
}

async function askUrl(
	session: PromptSession,
	question: string,
	preset: string | undefined,
): Promise<string> {
	if (preset !== undefined) {
		if (!preset) return "";
		const url = parseHttpUrl(preset);
		if (!url) throw new ArticleImportError("--client-url must be a full http(s) URL.");
		return url;
	}

	for (;;) {
		const answer = await ask(session, question);
		if (!answer) return "";
		const url = parseHttpUrl(answer);
		if (url) return url;
		console.error("  Enter a full http(s) URL, or leave it empty.");
	}
}

async function confirm(
	session: PromptSession,
	question: string,
	defaultYes: boolean,
): Promise<boolean> {
	const answer = (await session.line(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"} `))
		.trim()
		.toLowerCase();

	if (!answer) return defaultYes;
	return answer === "y" || answer === "yes";
}

/** A launch folder is as good as its `article.md` — the content skill always writes that name. */
function locateArticle(target: string): string | undefined {
	if (!fs.existsSync(target)) return undefined;
	if (!fs.statSync(target).isDirectory()) return target;

	const inside = path.join(target, "article.md");
	return fs.existsSync(inside) ? inside : undefined;
}

async function readArticle(
	session: PromptSession,
	initial: string,
): Promise<{ file: string; source: ArticleSource }> {
	let candidate = initial;

	for (let attempt = 0; attempt < MAX_PATH_ATTEMPTS; attempt += 1) {
		if (!candidate) {
			candidate = await ask(session, "Path to the article markdown (file or launch folder)");
		}

		if (candidate) {
			const file = locateArticle(resolveArticlePath(candidate, process.cwd(), homedir()));
			if (file) return { file, source: parseArticle(fs.readFileSync(file, "utf-8")) };
			console.error(`  No markdown file there: ${candidate}`);
		}

		candidate = "";
	}

	throw new ArticleImportError("No readable article path given.");
}

function otherProjectFiles(exclude: string): string[] {
	if (!fs.existsSync(PROJECTS_DIR)) return [];

	return fs
		.readdirSync(PROJECTS_DIR)
		.filter((entry) => entry.endsWith(".md"))
		.map((entry) => path.join(PROJECTS_DIR, entry))
		.filter((file) => file !== exclude)
		.map((file) => fs.readFileSync(file, "utf-8"));
}

function clientDisplay(client: ProjectClient): string {
	if ("sector" in client) return `${client.sector} (anonymised)`;
	return client.url ? `${client.name} — ${client.url}` : client.name;
}

type Flags = Partial<Record<keyof typeof OPTIONS, string | boolean>>;

async function resolveClient(
	session: PromptSession,
	flags: Flags,
	defaultSector: string | undefined,
): Promise<ProjectClient> {
	const named = typeof flags.client === "string" ? flags.client.trim() : undefined;
	const sector = typeof flags.sector === "string" ? flags.sector.trim() : undefined;
	const clientUrl = typeof flags["client-url"] === "string" ? flags["client-url"] : undefined;

	if (named) {
		const url = await askUrl(session, "Client URL (optional)", clientUrl);
		return url ? { name: named, url } : { name: named };
	}

	if (sector) return { sector };

	if (named === undefined && sector === undefined) {
		const answer = await ask(session, "Client name (empty = anonymised NDA work)");

		if (answer) {
			const url = await askUrl(session, "Client URL (optional)", clientUrl);
			return url ? { name: answer, url } : { name: answer };
		}
	}

	return { sector: await askRequired(session, "Sector for the anonymised client", defaultSector) };
}

async function resolveCapabilities(session: PromptSession, preset: string | undefined) {
	if (preset !== undefined) return parseProjectCapabilities(preset);

	for (;;) {
		try {
			return parseProjectCapabilities(
				await askRequired(
					session,
					"Capabilities (comma-separated: software, security, applied-r-and-d)",
				),
			);
		} catch (error) {
			console.error(
				`  ${error instanceof ArticleImportError ? error.message : "Enter valid capabilities."}`,
			);
		}
	}
}

async function resolvePublication(
	session: PromptSession,
	flags: Flags,
	defaultSector: string | undefined,
) {
	const provenance = parseProjectProvenance(
		typeof flags.provenance === "string" ? flags.provenance : undefined,
	);
	const capabilities = await resolveCapabilities(
		session,
		typeof flags.capabilities === "string" ? flags.capabilities : undefined,
	);

	if (provenance === "internal-r-and-d") return { provenance, capabilities } as const;
	return {
		provenance,
		capabilities,
		client: await resolveClient(session, flags, defaultSector),
	} as const;
}

function printArticleDefaults(file: string, defaults: ArticleDefaults): void {
	console.log(`\nRead ${file}`);
	console.log(`  Title:   ${defaults.title}`);
	console.log(`  Slug:    ${defaults.slug}`);
	console.log(`  Summary: ${defaults.summary}`);
	console.log(`  Tags:    ${defaults.tags.join(", ") || "(none derived)"}`);
	if (defaults.summary.length > SUMMARY_WARN_CHARS) {
		console.warn(
			`  Note: that summary is ${defaults.summary.length} characters — long for a meta description, worth trimming in the written file.`,
		);
	}
	console.log("");
}

async function run(session: PromptSession, positionals: string[], flags: Flags): Promise<number> {
	const { file, source } = await readArticle(session, positionals[0] ?? "");
	const defaults = articleDefaults(source, CURRENT_YEAR);

	printArticleDefaults(file, defaults);

	const year = await askYear(session, defaults.year, flags.year as string | undefined);
	const publication = await resolvePublication(session, flags, defaults.sector);
	const industry =
		typeof flags.industry === "string"
			? flags.industry.trim()
			: await ask(session, "Industry (optional, - for none)", defaults.industry ?? "");

	const target = projectFilePath(ROOT, defaults.slug);
	const targetExists = fs.existsSync(target);
	// Re-importing an edited article keeps the slot the project already holds.
	const order =
		(targetExists ? projectOrder(fs.readFileSync(target, "utf-8")) : undefined) ??
		nextProjectOrder(otherProjectFiles(target));

	const projectInput = {
		title: defaults.title,
		slug: defaults.slug,
		summary: defaults.summary,
		industry: industry || undefined,
		year,
		tags: defaults.tags,
		links: defaults.links,
		order,
		featured: false,
	} as const;
	const markdown = buildProjectMarkdown(source, { ...projectInput, ...publication });

	console.log("");
	console.log(
		`  Provenance:   ${publication.provenance === "internal-r-and-d" ? "Internal R&D" : "Client work"}`,
	);
	console.log(`  Capabilities: ${publication.capabilities.join(", ")}`);
	if (publication.provenance !== "internal-r-and-d") {
		console.log(`  Client:       ${clientDisplay(publication.client)}`);
	}
	console.log(`  Industry: ${industry || "(none)"}`);
	console.log(`  Year:     ${year}`);
	console.log(`  Order:    ${order}`);
	console.log(`  Target:   ${path.relative(ROOT, target)}${targetExists ? " (exists)" : ""}`);
	console.log(`  URL:      https://auditmos.com/work/${defaults.slug}`);

	if (flags["dry-run"] === true) {
		console.log(`\n--- ${path.relative(ROOT, target)} (dry run, nothing written) ---\n`);
		console.log(markdown);
		return 0;
	}

	const question = targetExists ? "Overwrite that project?" : "Write it?";
	if (flags.yes !== true && !(await confirm(session, `\n${question}`, !targetExists))) {
		console.log("Aborted, nothing written.");
		return 1;
	}

	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, markdown, "utf-8");

	console.log(`\nWrote ${path.relative(ROOT, target)}`);
	console.log(
		"Next: pnpm types && pnpm test, then pnpm preview to check /work — pnpm deploy:production to publish.",
	);
	return 0;
}

async function main(): Promise<void> {
	const session = new PromptSession();

	try {
		const { values, positionals } = parseArgs({
			args: process.argv.slice(2),
			options: OPTIONS,
			allowPositionals: true,
		});

		if (values.help === true) {
			console.log(usage());
			return;
		}

		process.exitCode = await run(session, positionals, values);
	} catch (error) {
		console.error(
			`\n${error instanceof ArticleImportError ? error.message : `Import failed: ${error instanceof Error ? error.message : String(error)}`}`,
		);
		process.exitCode = 1;
	} finally {
		session.close();
	}
}

await main();
