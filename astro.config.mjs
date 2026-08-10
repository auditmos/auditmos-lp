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
	// Astro refuses any on-demand POST with a form-like content type unless the
	// request's `Origin` matches this site. RFC 6749 requires the OAuth token
	// request to be `application/x-www-form-urlencoded`, and it is sent by a
	// server-side agent, which has no `Origin` to send — so the guard refused
	// every legitimate client with a 403 before the handler ever ran.
	//
	// Safe to remove only because nothing here leans on it: `/api/contact` is
	// gated on a Turnstile token a cross-site form cannot obtain, and `/mcp`
	// runs its own explicit origin allowlist. A future route that accepts a
	// form body must bring its own check — see src/oauth/token-endpoint-origin.test.ts.
	security: { checkOrigin: false },
	// Retired `@astrojs/sitemap` output. These were live, so send anything
	// holding them (Search Console, a crawler's queue) to the real sitemap
	// instead of a 404. The adapter compiles these into `_redirects`, so the
	// asset server answers them without invoking the Worker.
	redirects: {
		"/sitemap-index.xml": { status: 301, destination: "/sitemap.xml" },
		"/sitemap-0.xml": { status: 301, destination: "/sitemap.xml" },
		// RFC 9728 §3.1 puts the protected-resource metadata for `<site>/mcp` at
		// `/.well-known/oauth-protected-resource/mcp`, which is where the document
		// is generated. MCP clients and the readiness scanners ask for the bare
		// path instead, and the build output cannot hold a file and a directory
		// of the same name — so the bare path redirects to the derived one and
		// both audiences reach the same document.
		"/.well-known/oauth-protected-resource": {
			status: 302,
			destination: "/.well-known/oauth-protected-resource/mcp",
		},
	},
	// The `/projects` → `/work` rename is redirected from `public/_redirects`
	// instead: a dynamic destination declared here is resolved to the file
	// backing it (`/work/:slug/index.html`), which is not the canonical URL and
	// 404s for the `.md` twins. See that file.
	markdown: {
		// Shiki inlines the theme's background on every fenced block, so the theme
		// is the only place that colour can be chosen. `github-dark` is a warm
		// #24292e that reads as a foreign panel against the site's blue-black;
		// `github-dark-default` is #0d1117, within a hair of `--color-neutral-950`.
		shikiConfig: { theme: "github-dark-default" },
	},
	// No sitemap integration: `src/pages/sitemap.xml.ts` owns the sitemap, at the
	// path robots.txt advertises. `agentDiscoveryHeaders` appends to the `_headers`
	// file the Cloudflare adapter writes, so it must stay after the adapter.
	integrations: [agentDiscoveryHeaders()],
	vite: {
		plugins: [tailwindcss()],
	},
});
