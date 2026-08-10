/**
 * Reproduces the duplicate-URL bug: `/work/<slug>/` answered 200 with the page
 * body instead of redirecting to the slash-free URL the site declares canonical.
 *
 * `assets.run_worker_first` lists `/work/*`, so the Worker answers those page
 * requests through the Astro adapter, which resolves a prerendered route
 * straight to the file backing it. The asset server's
 * `html_handling: "drop-trailing-slash"` never runs, so nothing normalises the
 * slash form. This is the Worker-side normalisation that fills that gap.
 *
 * Assumptions:
 * - Permanent (301), because the target is the canonical URL forever — that is
 *   what consolidates ranking signals onto one URL.
 * - Read-only methods only: a 301 lets a client turn POST into GET, so the
 *   request-time endpoints must pass through untouched.
 */

import { canonicalRedirect } from "./canonical-url";

function redirectFor(url: string, init: RequestInit = {}): Response | undefined {
	return canonicalRedirect(new Request(url, init));
}

describe("canonicalRedirect", () => {
	describe("when a page is requested with a trailing slash", () => {
		it("permanently redirects a project page to its slash-free URL", () => {
			const response = redirectFor("https://auditmos.com/work/client-owned-gpu-fleet-crm/");

			expect(response?.status).toBe(301);
			expect(response?.headers.get("Location")).toBe(
				"https://auditmos.com/work/client-owned-gpu-fleet-crm",
			);
		});

		it.each([
			["https://auditmos.com/about/", "https://auditmos.com/about"],
			["https://auditmos.com/work/", "https://auditmos.com/work"],
			["https://auditmos.com/work/a-slug.md/", "https://auditmos.com/work/a-slug.md"],
			["https://staging.auditmos.com/partners/", "https://staging.auditmos.com/partners"],
		])("redirects %s to %s", (from, to) => {
			expect(redirectFor(from)?.headers.get("Location")).toBe(to);
		});

		it("keeps the query string, so campaign and tracking parameters survive", () => {
			const response = redirectFor("https://auditmos.com/work/a-slug/?utm_source=llms&page=2");

			expect(response?.headers.get("Location")).toBe(
				"https://auditmos.com/work/a-slug?utm_source=llms&page=2",
			);
		});

		it("collapses repeated trailing slashes to one canonical target", () => {
			expect(redirectFor("https://auditmos.com/work/a-slug///")?.headers.get("Location")).toBe(
				"https://auditmos.com/work/a-slug",
			);
		});

		it("answers HEAD with the same redirect and no body", async () => {
			const response = redirectFor("https://auditmos.com/work/a-slug/", { method: "HEAD" });

			expect(response?.status).toBe(301);
			expect(await response?.text()).toBe("");
		});

		it("lets caches and crawlers store the permanent redirect", () => {
			expect(
				redirectFor("https://auditmos.com/work/a-slug/")?.headers.get("Cache-Control"),
			).toMatch(/max-age=\d+/);
		});
	});

	describe("when the URL is already canonical", () => {
		it.each([
			"https://auditmos.com/",
			"https://auditmos.com/about",
			"https://auditmos.com/work/client-owned-gpu-fleet-crm",
			"https://auditmos.com/work/client-owned-gpu-fleet-crm.md",
			"https://auditmos.com/llms.txt",
			"https://auditmos.com/work/a-slug?trailing=slash/",
		])("passes %s through", (url) => {
			expect(redirectFor(url)).toBeUndefined();
		});
	});

	describe("when the method is not read-only", () => {
		it.each([
			"POST",
			"PUT",
			"PATCH",
			"DELETE",
			"OPTIONS",
		])("leaves %s alone so a 301 cannot rewrite it to GET", (method) => {
			expect(redirectFor("https://auditmos.com/api/contact/", { method })).toBeUndefined();
			expect(redirectFor("https://auditmos.com/mcp/", { method })).toBeUndefined();
		});
	});
});
