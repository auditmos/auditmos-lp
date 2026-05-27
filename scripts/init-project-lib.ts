/**
 * Pure helpers extracted from init-project.ts for testability.
 *
 * Nothing in this file touches the filesystem, network, or process —
 * each function is referentially transparent and tested via
 * scripts/init-project-lib.test.ts. Side-effect orchestration stays
 * in init-project.ts.
 */

import type { FanoutResult, RenameResult } from "./init-project-types";

/**
 * Strip JSON-with-comments down to plain JSON so JSON.parse can handle it.
 * Handles both block and line comments. Does NOT handle trailing commas
 * (drizzle-kit / wrangler don't emit them in our templates).
 */
export function stripJsonc(content: string): string {
	return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * Project names must be kebab-case: lowercase letters, digits, single dashes,
 * starting with a letter. Matches npm naming for non-scoped packages.
 */
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export function isValidProjectName(name: string): boolean {
	return KEBAB_CASE.test(name);
}

/**
 * Compute which required wrangler env blocks are missing from a parsed
 * wrangler.jsonc body. Separated from file IO so it can be unit-tested
 * against arbitrary content.
 */
export function missingWranglerEnvs(
	parsed: { env?: Record<string, unknown> } | null,
	required: readonly string[],
): string[] {
	const envs = parsed?.env ?? {};
	return required.filter((e) => !envs[e]);
}

/**
 * UX symbol for a step result. Consistent across the script output.
 */
export function symbolFor(result: RenameResult | FanoutResult): string {
	if (result === "renamed" || result === "copied") return "✓";
	if (result === "skipped") return "·";
	return "✗";
}
