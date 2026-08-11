/**
 * Where the Astro/Vite build keeps its local miniflare state.
 *
 * Two miniflare majors live in this tree and neither is pinned by this repo —
 * both arrive transitively, so `pnpm dedupe` cannot merge them:
 *
 * - miniflare 4, via `@cloudflare/vite-plugin` ← `@astrojs/cloudflare`. This is
 *   what `astro build` prerenders on, and what `astro dev` / `astro preview` run.
 * - miniflare 5-alpha, via `wrangler`. This is what `wrangler dev` runs.
 *
 * They disagree about the schema of the `SENTRY_DO` observability store:
 * miniflare 5-alpha writes a `_cf_ALARM` table with three columns, miniflare 4
 * inserts two values into it. Left on the same persist root, whichever starts
 * second dies with `table _cf_ALARM has 3 columns but 2 values were supplied`,
 * and since `pnpm deploy*` all run the build first, every deploy path is
 * blocked until someone deletes `.wrangler/state` by hand. Clearing only
 * `state/v3/observability` looks right — `SENTRY_DO` is the observability trace
 * store and that directory carries the newest timestamp — and is not enough:
 * the conflicting tables also live under `do/`, `cache/`, `kv/` and `images/`.
 *
 * Giving the build its own root makes the collision structurally impossible
 * rather than merely unlikely, and it covers a live `wrangler dev` too: an
 * orphaned workerd holding `-shm` handles now holds them on a directory the
 * build never opens.
 *
 * The build side is the one that moves, deliberately. `wrangler dev` is typed
 * by a human ad hoc rather than run from a package script, so a fix that
 * depended on remembering `--persist-to` would be no fix at all.
 */

/** Where `wrangler dev` persists, absent a `--persist-to` nobody should need. */
export const WRANGLER_DEFAULT_STATE_PATH = ".wrangler/state";

/** Passed to the Cloudflare adapter as `persistState` in `astro.config.mjs`. */
export const ASTRO_MINIFLARE_STATE_PATH = ".wrangler/state-astro";
