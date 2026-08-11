/**
 * The two miniflare majors in this tree must never share a state directory.
 *
 * This is a contract test, not a behaviour test: the failure it guards against
 * only shows up as a corrupt SQLite table on the *next* build, long after the
 * config change that caused it, so asserting on the wiring is the only way to
 * catch it at the moment it breaks.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ASTRO_MINIFLARE_STATE_PATH, WRANGLER_DEFAULT_STATE_PATH } from "./miniflare-state";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const astroConfigSource = readFileSync(resolve(repoRoot, "astro.config.mjs"), "utf8");

describe("miniflare state isolation", () => {
	it("keeps the build's state out of the directory wrangler writes", () => {
		// `wrangler dev` runs miniflare 5-alpha, which writes a `_cf_ALARM` table
		// with three columns; the build runs miniflare 4, which inserts two values
		// into it. Whichever opens the directory second dies on it.
		expect(ASTRO_MINIFLARE_STATE_PATH).not.toBe(WRANGLER_DEFAULT_STATE_PATH);
	});

	it("keeps neither path nested inside the other", () => {
		// Sibling directories, not parent and child: miniflare walks the tree
		// under its persist root, so nesting would put wrangler's tables back in
		// the build's reach and reopen the collision.
		expect(ASTRO_MINIFLARE_STATE_PATH.startsWith(`${WRANGLER_DEFAULT_STATE_PATH}/`)).toBe(false);
		expect(WRANGLER_DEFAULT_STATE_PATH.startsWith(`${ASTRO_MINIFLARE_STATE_PATH}/`)).toBe(false);
	});

	it("keeps the build's state under the gitignored .wrangler directory", () => {
		expect(ASTRO_MINIFLARE_STATE_PATH.startsWith(".wrangler/")).toBe(true);
		expect(readFileSync(resolve(repoRoot, ".gitignore"), "utf8")).toContain(".wrangler/");
	});

	it("hands that path to the Cloudflare adapter rather than restating it", () => {
		// A literal in astro.config.mjs would drift from this module silently,
		// and the drift is invisible until someone runs `wrangler dev`.
		expect(astroConfigSource).toContain("ASTRO_MINIFLARE_STATE_PATH");
		expect(astroConfigSource).toMatch(
			/persistState:\s*\{\s*path:\s*ASTRO_MINIFLARE_STATE_PATH\s*\}/,
		);
	});
});
