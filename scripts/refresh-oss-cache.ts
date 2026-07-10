#!/usr/bin/env tsx
/**
 * Refreshes the committed OSS aggregator cache (`.cache/oss-projects.json`) from the
 * GitHub API before `astro build`. Runs in Node — where `fetch` and `fs` work — so the
 * prerendered `/open-source` page can statically import the JSON instead of doing any
 * network or filesystem work inside the Cloudflare Workers build runtime.
 *
 * Never fails the build: the aggregator degrades to the existing cache (or an empty list)
 * on any GitHub error, and this wrapper additionally swallows its own IO errors.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fetchOssProjects, type OssProject, type OssProjectCache } from "../src/oss/aggregator";

const CACHE_FILE = resolve(process.cwd(), ".cache", "oss-projects.json");

const fileCache: OssProjectCache = {
	async read() {
		const raw = await readFile(CACHE_FILE, "utf8");
		return JSON.parse(raw) as OssProject[];
	},
	async write(projects) {
		await mkdir(dirname(CACHE_FILE), { recursive: true });
		await writeFile(CACHE_FILE, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
	},
};

try {
	const projects = await fetchOssProjects({
		fetch,
		cache: fileCache,
		token: process.env.GITHUB_TOKEN,
		logger: console,
	});
	console.log(`oss cache refreshed: ${projects.length} repositories`);
} catch (error) {
	console.error("oss cache refresh skipped:", error);
}
