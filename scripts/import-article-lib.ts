import path from "node:path";
import { parse as parseYaml } from "yaml";
import { escapeYamlString, slugifyProjectTitle } from "./new-project-lib";

/**
 * Turns an externally authored launch article (the `content-launch` skill's
 * `article.md`) into a `projects` collection entry. The article carries its own
 * frontmatter written for a writing app, not for this site's Zod schema — this
 * module maps the overlap, derives what it can (title, slug, summary, tags),
 * and leaves the rest to the caller's prompts.
 */

export class ArticleImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ArticleImportError";
	}
}

export interface ProjectLink {
	label: string;
	url: string;
}

export interface ArticleSource {
	frontmatter: Record<string, unknown>;
	body: string;
}

/** Everything the article itself can answer, used to prefill the prompts. */
export interface ArticleDefaults {
	title: string;
	slug: string;
	summary: string;
	tags: string[];
	year: number;
	sector?: string;
	industry?: string;
	anonymised: boolean;
	links: ProjectLink[];
}

export type ProjectClient = { name: string; url?: string } | { sector: string };

export interface ProjectFileInput {
	title: string;
	slug: string;
	summary: string;
	client: ProjectClient;
	industry?: string;
	year: number;
	tags: readonly string[];
	links?: readonly ProjectLink[];
	order?: number;
	featured?: boolean;
}

const FRONTMATTER_BLOCK = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const H1_LINE = /^#[ \t]+(.+?)[ \t]*$/m;
const LEADING_H1 = /^#[ \t]+.*(?:\r?\n)+/;
const ORDER_LINE = /^order:[ \t]*(-?\d+)[ \t]*$/m;
const SENTENCE = /[^.!?]+[.!?]+(?=\s|$)/g;

/** Tags shown on `/work` are short and human-readable, not a full dependency list. */
const MAX_TAGS = 6;
/** The summary is also the page's meta description, so it stays inside the usual budget. */
const SUMMARY_MAX_CHARS = 160;

/**
 * Fallback tag inference for articles that ship no `stack`/`tags` frontmatter.
 * Ordered most specific first; the first `MAX_TAGS` matches win.
 */
const TAG_PATTERNS: readonly (readonly [string, RegExp])[] = [
	["Cloudflare Workers", /\bcloudflare workers?\b/i],
	["Astro", /\bastro\b/i],
	["TanStack Start", /\btanstack\b/i],
	["Hono", /\bhono\b/i],
	["Drizzle ORM", /\bdrizzle\b/i],
	["Postgres", /\b(?:neon\s+)?postgres(?:ql)?\b/i],
	["SQLite", /\bsqlite\b/i],
	["DuckDB", /\bduckdb\b/i],
	["Better Auth", /\bbetter[\s-]?auth\b/i],
	["React", /\breact\b/i],
	["TypeScript", /\btypescript\b/i],
	["Python", /\bpython\b/i],
	["Telegram bot", /\btelegram\b/i],
	["Stripe", /\bstripe\b/i],
	["Model Context Protocol", /\b(?:mcp|model context protocol)\b/i],
	["LLM integration", /\b(?:llms?|large language model|openai|anthropic|claude)\b/i],
	["Security audit", /\bsecurity (?:audit|review)\b/i],
	["Threat modeling", /\bthreat model/i],
	["Penetration testing", /\bpen(?:etration)?[\s-]?test/i],
	["GPU compute", /\bgpus?\b/i],
	["Distributed systems", /\bdistributed\b/i],
	["Scheduled jobs", /\bcron\b|\bscheduled (?:jobs?|tasks?)\b/i],
	["Observability", /\bobservability\b|\btelemetry\b/i],
	["Platform architecture", /\barchitecture\b/i],
];

function readString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function firstString(frontmatter: Record<string, unknown>, keys: readonly string[]) {
	for (const key of keys) {
		const value = readString(frontmatter[key]);
		if (value) return value;
	}
	return undefined;
}

function readStringList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((item) => {
			const text = readString(item);
			return text ? [text] : [];
		});
	}

	const text = readString(value);
	if (!text) return [];
	return text
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function readLinks(value: unknown): ProjectLink[] {
	if (!Array.isArray(value)) return [];

	return value.flatMap((item) => {
		if (typeof item !== "object" || item === null) return [];
		const record = item as Record<string, unknown>;
		const url = readString(record.url);
		if (!url) return [];
		const label = readString(record.label) ?? url.replace(/^https?:\/\//, "");
		return [{ label, url }];
	});
}

function capitalizeFirst(value: string): string {
	const first = value.charAt(0);
	return first ? `${first.toUpperCase()}${value.slice(1)}` : value;
}

function dedupe(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const kept: string[] = [];

	for (const value of values) {
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		kept.push(value);
	}

	return kept;
}

function inferTags(text: string): string[] {
	return TAG_PATTERNS.flatMap(([tag, pattern]) => (pattern.test(text) ? [tag] : []));
}

function deriveTags(frontmatter: Record<string, unknown>, searchText: string): string[] {
	const declared = dedupe([
		...readStringList(frontmatter.stack),
		...readStringList(frontmatter.tags),
		...readStringList(frontmatter.technologies),
	]);
	const tags = declared.length > 0 ? declared : inferTags(searchText);
	return tags.slice(0, MAX_TAGS);
}

/** Prose blocks only — headings, lists, tables, quotes and fences are not summaries. */
function firstProseParagraph(body: string): string | undefined {
	let inFence = false;
	const paragraph: string[] = [];

	for (const rawLine of body.split(/\r?\n/)) {
		const line = rawLine.trim();

		if (line.startsWith("```") || line.startsWith("~~~")) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;

		const isProse =
			line.length > 0 &&
			!line.startsWith("#") &&
			!line.startsWith("|") &&
			!line.startsWith(">") &&
			!line.startsWith("---") &&
			!/^[-*+][ \t]/.test(line) &&
			!/^\d+[.)][ \t]/.test(line);

		if (isProse) {
			paragraph.push(line);
			continue;
		}
		if (paragraph.length > 0) break;
	}

	return paragraph.length > 0 ? paragraph.join(" ") : undefined;
}

function tldrSection(body: string): string | undefined {
	const heading = /^#{2,3}[ \t]*TL[;\s]?DR\b.*$/im.exec(body);
	if (!heading) return undefined;

	const after = body.slice(heading.index + heading[0].length);
	const nextHeading = /^#{1,6}[ \t]/m.exec(after);
	return nextHeading ? after.slice(0, nextHeading.index) : after;
}

/** One or two whole sentences — a lead paragraph, not a truncated one. */
function leadSentences(paragraph: string): string {
	const sentences = paragraph.match(SENTENCE)?.map((sentence) => sentence.trim()) ?? [];
	if (sentences.length === 0) return paragraph.trim();

	let lead = sentences[0] ?? "";
	for (const sentence of sentences.slice(1)) {
		const candidate = `${lead} ${sentence}`;
		if (candidate.length > SUMMARY_MAX_CHARS) break;
		lead = candidate;
	}

	return lead;
}

function deriveSummary(frontmatter: Record<string, unknown>, body: string): string {
	const declared = firstString(frontmatter, ["summary", "description", "excerpt"]);
	if (declared) return declared;

	const source = tldrSection(body) ?? body;
	const paragraph = firstProseParagraph(source) ?? firstProseParagraph(body);

	if (!paragraph) {
		throw new ArticleImportError(
			"Could not derive a summary: the article has no prose paragraph. Add `summary:` to its frontmatter.",
		);
	}

	return leadSentences(paragraph);
}

/** Body as it belongs in the collection: no frontmatter, no H1 (the page renders its own). */
function projectBody(body: string): string {
	return `${body.replace(/^\s+/, "").replace(LEADING_H1, "").trim()}\n`;
}

export function parseArticle(raw: string): ArticleSource {
	const match = FRONTMATTER_BLOCK.exec(raw);

	if (!match) {
		return { frontmatter: {}, body: raw.replace(/^﻿/, "") };
	}

	const [block, yamlText = ""] = match;
	let parsed: unknown;

	try {
		parsed = parseYaml(yamlText);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new ArticleImportError(`Article frontmatter is not valid YAML: ${detail}`);
	}

	const frontmatter =
		typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};

	return { frontmatter, body: raw.slice(block.length) };
}

export function articleDefaults(source: ArticleSource, fallbackYear: number): ArticleDefaults {
	const { frontmatter, body } = source;
	const title = firstString(frontmatter, ["title"]) ?? H1_LINE.exec(body)?.[1]?.trim();

	if (!title) {
		throw new ArticleImportError(
			"Could not determine a title: the article has neither `title:` frontmatter nor an H1 heading.",
		);
	}

	const declaredSlug = firstString(frontmatter, ["slug"]);
	const rawYear = frontmatter.year;
	const year =
		typeof rawYear === "number" && Number.isInteger(rawYear)
			? rawYear
			: Number.parseInt(readString(rawYear) ?? "", 10);
	const rawSector = firstString(frontmatter, ["sector", "client_sector"]);
	// Articles write the sector as running prose ("distributed GPU compute");
	// the project card renders it as a label.
	const sector = rawSector ? capitalizeFirst(rawSector) : undefined;
	const disclosure = firstString(frontmatter, ["disclosure"]) ?? "";
	const industry = firstString(frontmatter, ["industry"]) ?? sector;

	return {
		title,
		slug: slugifyProjectTitle(declaredSlug ?? title),
		summary: deriveSummary(frontmatter, body),
		tags: deriveTags(frontmatter, `${title}\n${body}`),
		year: Number.isInteger(year) ? year : fallbackYear,
		sector,
		industry,
		anonymised: /^anonymi[sz]ed$/i.test(disclosure),
		links: readLinks(frontmatter.links),
	};
}

/**
 * Next free `order` value, so an imported project lands at the end of `/work`
 * instead of behind every already-ordered entry.
 */
export function nextProjectOrder(existingProjectFiles: readonly string[]): number {
	const orders = existingProjectFiles.flatMap((contents) => {
		const order = projectOrder(contents);
		return order === undefined ? [] : [order];
	});

	return orders.length > 0 ? Math.max(...orders) + 1 : 1;
}

/** The `order:` already published for a project, so re-importing keeps its slot. */
export function projectOrder(contents: string): number | undefined {
	const match = ORDER_LINE.exec(contents);
	const order = match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;
	return Number.isInteger(order) ? order : undefined;
}

export function projectFilePath(root: string, slug: string): string {
	return path.join(root, "src", "content", "projects", `${slug}.md`);
}

/** Accepts what a terminal actually pastes: surrounding quotes, `\ ` escapes, `~/`. */
export function resolveArticlePath(input: string, cwd: string, home: string): string {
	let value = input.trim();
	const quote = value.charAt(0);

	if (value.length > 1 && (quote === '"' || quote === "'") && value.endsWith(quote)) {
		value = value.slice(1, -1);
	}

	value = value.replace(/\\(.)/g, "$1");

	if (value === "~") value = home;
	else if (value.startsWith("~/")) value = path.join(home, value.slice(2));

	return path.resolve(cwd, value);
}

export function buildProjectMarkdown(source: ArticleSource, input: ProjectFileInput): string {
	const quoted = (key: string, value: string, indent = "") =>
		`${indent}${key}: "${escapeYamlString(value)}"`;

	const lines: string[] = [
		"---",
		quoted("title", input.title),
		quoted("slug", input.slug),
		quoted("summary", input.summary),
		"client:",
	];

	if ("name" in input.client) {
		lines.push(quoted("name", input.client.name, "  "));
		if (input.client.url) lines.push(quoted("url", input.client.url, "  "));
	} else {
		lines.push(quoted("sector", input.client.sector, "  "));
	}

	if (input.industry) lines.push(quoted("industry", input.industry));
	lines.push(`year: ${input.year}`);

	if (input.tags.length === 0) {
		lines.push("stack: []");
	} else {
		lines.push("stack:", ...input.tags.map((tag) => `  - "${escapeYamlString(tag)}"`));
	}

	lines.push(`featured: ${input.featured ?? false}`);
	if (input.order !== undefined) lines.push(`order: ${input.order}`);

	const links = input.links ?? [];
	if (links.length > 0) {
		lines.push("links:");
		for (const link of links) {
			lines.push(quoted("- label", link.label, "  "), quoted("url", link.url, "    "));
		}
	}

	lines.push("---", "", projectBody(source.body));
	return lines.join("\n");
}
