// @ts-check
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { agentDiscoveryHeaders } from "./src/site/discovery-headers";

// https://astro.build/config
export default defineConfig({
	site: "https://auditmos.com",
	output: "server",
	// Matches `html_handling: "drop-trailing-slash"` in wrangler.jsonc, so the dev
	// server resolves the same slash-free URLs as production.
	// `build.format` stays "directory".
	trailingSlash: "never",
	adapter: cloudflare(),
	// Retired `@astrojs/sitemap` output. These were live, so send anything
	// holding them (Search Console, a crawler's queue) to the real sitemap
	// instead of a 404. The adapter compiles these into `_redirects`, so the
	// asset server answers them without invoking the Worker.
	redirects: {
		"/sitemap-index.xml": { status: 301, destination: "/sitemap.xml" },
		"/sitemap-0.xml": { status: 301, destination: "/sitemap.xml" },
	},
	// No sitemap integration: `src/pages/sitemap.xml.ts` owns the sitemap, at the
	// path robots.txt advertises. `agentDiscoveryHeaders` appends to the `_headers`
	// file the Cloudflare adapter writes, so it must stay after the adapter.
	integrations: [agentDiscoveryHeaders()],
	vite: {
		plugins: [tailwindcss()],
	},
});
