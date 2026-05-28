#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectMarkdownTemplate, projectPathForTitle } from "./new-project-lib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage(): string {
	return 'Usage: pnpm new-project "<title>"';
}

function main(argv: string[]): void {
	const title = argv.join(" ").trim();

	if (!title) {
		console.error(usage());
		process.exitCode = 1;
		return;
	}

	const target = projectPathForTitle(ROOT, title);

	if (fs.existsSync(target)) {
		console.error(`Project already exists: ${target}`);
		process.exitCode = 1;
		return;
	}

	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, projectMarkdownTemplate(title, new Date().getFullYear()), "utf-8");
	console.log(target);
}

main(process.argv.slice(2));
