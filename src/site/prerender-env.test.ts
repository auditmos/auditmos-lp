import type { AstroIntegration } from "astro";
import { scopeCloudflareEnvAroundPrerender } from "./prerender-env";

type BuildHook = "astro:build:ssr" | "astro:build:generated" | "astro:build:done";

// None of these hooks reads its argument, so the Astro-supplied one is omitted.
function run(integration: AstroIntegration, hook: BuildHook): void {
	(integration.hooks[hook] as unknown as () => void)();
}

describe("scopeCloudflareEnvAroundPrerender", () => {
	it("hides CLOUDFLARE_ENV from the prerender window and restores it after generation", () => {
		const env: Record<string, string | undefined> = { CLOUDFLARE_ENV: "production", OTHER: "kept" };
		const integration = scopeCloudflareEnvAroundPrerender(env);

		run(integration, "astro:build:ssr");
		expect(env).toEqual({ OTHER: "kept" });

		run(integration, "astro:build:generated");
		expect(env).toEqual({ CLOUDFLARE_ENV: "production", OTHER: "kept" });
	});

	it("restores by astro:build:done when generation never ran", () => {
		const env: Record<string, string | undefined> = { CLOUDFLARE_ENV: "staging" };
		const integration = scopeCloudflareEnvAroundPrerender(env);

		run(integration, "astro:build:ssr");
		run(integration, "astro:build:done");

		expect(env.CLOUDFLARE_ENV).toBe("staging");
	});

	it("never invents the variable for a local build that did not set it", () => {
		const env: Record<string, string | undefined> = {};
		const integration = scopeCloudflareEnvAroundPrerender(env);

		run(integration, "astro:build:ssr");
		run(integration, "astro:build:generated");
		run(integration, "astro:build:done");

		expect("CLOUDFLARE_ENV" in env).toBe(false);
	});
});
