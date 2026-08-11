import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(import.meta.dirname, "src"),
		},
	},
	test: {
		globals: true,
		// Clears the shared-build state before any worker starts. It never builds
		// — see the file for why that distinction matters under test filtering.
		globalSetup: ["./vitest.global-setup.ts"],
		include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
		exclude: ["src/pages/**", "node_modules/**", "dist/**", ".astro/**"],
	},
});
