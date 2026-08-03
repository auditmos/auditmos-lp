#!/usr/bin/env tsx
/**
 * Refreshes the committed audit-report cache (`.cache/audit-reports.json`) from the GitHub API
 * before `astro build`. Runs in Node — where `fetch` and `fs` work — so prerendered pages can
 * statically import the JSON instead of doing any network or filesystem work inside the
 * Cloudflare Workers build runtime.
 *
 * Never fails the build: the aggregator degrades to the existing cache (or an empty list) on
 * any GitHub error, and this wrapper additionally swallows its own IO errors.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
	type AuditReport,
	type AuditReportCache,
	fetchAuditReports,
} from "../src/audits/aggregator";

const CACHE_FILE = resolve(process.cwd(), ".cache", "audit-reports.json");

const fileCache: AuditReportCache = {
	async read() {
		const raw = await readFile(CACHE_FILE, "utf8");
		return JSON.parse(raw) as AuditReport[];
	},
	async write(reports) {
		await mkdir(dirname(CACHE_FILE), { recursive: true });
		await writeFile(CACHE_FILE, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
	},
};

try {
	const reports = await fetchAuditReports({
		fetch,
		cache: fileCache,
		token: process.env.GITHUB_TOKEN,
		logger: console,
	});
	console.log(`audit cache refreshed: ${reports.length} reports`);
} catch (error) {
	console.error("audit cache refresh skipped:", error);
}
