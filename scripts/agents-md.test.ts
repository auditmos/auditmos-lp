/**
 * Contract test for the stack table in AGENTS.md (CLAUDE.md is a symlink to it).
 *
 * Agents read that table as the truth about this repository, and nothing else
 * checks it: it said "pnpm 10" while `packageManager` pinned pnpm 12. A row
 * that names a version is asserted against package.json, so a bump that forgets
 * the table fails here instead of misleading the next reader.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const agentsMd = readFileSync(resolve(root, "AGENTS.md"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
	packageManager: string;
};

/** The Technology cell of a row in the AGENTS.md stack table. */
function stackRow(layer: string): string | undefined {
	const row = agentsMd.split("\n").find((line) => line.startsWith(`| ${layer} |`));
	return row?.split("|")[2]?.trim();
}

describe("AGENTS.md stack table", () => {
	it("names the pnpm major that packageManager pins", () => {
		const major = packageJson.packageManager.match(/^pnpm@(\d+)\./)?.[1];

		expect(major).toBeDefined();
		expect(stackRow("Package manager")).toBe(`pnpm ${major}`);
	});
});
