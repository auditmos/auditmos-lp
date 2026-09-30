/**
 * Hides `CLOUDFLARE_ENV` from the Node process while the Cloudflare adapter
 * prerenders, and only then.
 *
 * `scripts/deploy.ts` exports `CLOUDFLARE_ENV` into the build so the Vite
 * plugin flattens that env block of wrangler.jsonc into `dist/server/.prerender/
 * wrangler.json`. The adapter's prerenderer then reads that flattened file
 * through `wrangler.unstable_readConfig({ config })`, which passes no `env`, so
 * wrangler falls back to the same variable and looks for an `env.<name>`
 * section a flattened file never has — printing "No environment found in
 * configuration" on every deploy (upstream in `@cloudflare/vite-plugin`, still
 * present in 1.62). The fallback reuses the flattened top level, so the warning
 * is noise, but noise in a deploy log trains you to skip real warnings.
 *
 * `astro:build:ssr` runs in the same step as, and directly before, the
 * prerenderer's setup; `astro:build:generated` runs once prerendering is done.
 * Nothing in between needs Node's copy: prerendered pages read `process.env`
 * inside workerd, where `nodejs_compat` fills it from the Worker's own vars.
 * The variable is back before `astro:build:done`, where `agentDiscoveryHeaders`
 * reads it to decide the noindex header.
 */

import type { AstroIntegration } from "astro";

const VARIABLE = "CLOUDFLARE_ENV";

export function scopeCloudflareEnvAroundPrerender(
	env: Record<string, string | undefined> = process.env,
): AstroIntegration {
	let hidden: string | undefined;

	const restore = (): void => {
		if (hidden === undefined) return;
		env[VARIABLE] = hidden;
		hidden = undefined;
	};

	return {
		name: "auditmos:scope-cloudflare-env-around-prerender",
		hooks: {
			"astro:build:ssr": () => {
				hidden = env[VARIABLE];
				delete env[VARIABLE];
			},
			"astro:build:generated": restore,
			// Only reached without `generated` if generation had nothing to do.
			"astro:build:done": restore,
		},
	};
}
