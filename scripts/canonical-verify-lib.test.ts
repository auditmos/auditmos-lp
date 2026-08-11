import {
	formatRedirectReport,
	type RedirectProbe,
	trailingSlashProbeTargets,
	verifyTrailingSlashRedirects,
} from "./canonical-verify-lib";

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url><loc>https://auditmos.com/</loc></url>
	<url><loc>https://auditmos.com/about</loc></url>
	<url><loc>https://auditmos.com/work/a-slug</loc></url>
</urlset>`;

function probe(overrides: Partial<RedirectProbe> = {}): RedirectProbe {
	return {
		url: "https://auditmos.com/about/",
		status: 301,
		location: "https://auditmos.com/about",
		...overrides,
	};
}

describe("trailingSlashProbeTargets", () => {
	it("derives the trailing-slash form of every sitemap URL", () => {
		expect(trailingSlashProbeTargets(sitemap)).toEqual([
			"https://auditmos.com/about/",
			"https://auditmos.com/work/a-slug/",
		]);
	});

	it("excludes the root, which is canonical with its slash", () => {
		expect(trailingSlashProbeTargets(sitemap)).not.toContain("https://auditmos.com//");
	});

	it("covers project pages without being told about them", () => {
		// The point of reading the sitemap rather than importing the page list:
		// a newly published project is probed the moment it ships.
		expect(trailingSlashProbeTargets(sitemap)).toContain("https://auditmos.com/work/a-slug/");
	});

	it("deduplicates and returns nothing for an empty sitemap", () => {
		expect(trailingSlashProbeTargets("<urlset></urlset>")).toEqual([]);
	});
});

describe("verifyTrailingSlashRedirects", () => {
	it("accepts a 301 to the slash-free path", () => {
		expect(verifyTrailingSlashRedirects([probe()])).toEqual([]);
	});

	it("accepts a relative Location, resolving it against the request", () => {
		expect(verifyTrailingSlashRedirects([probe({ location: "/about" })])).toEqual([]);
	});

	it("rejects the 307 that issue #38 was actually serving", () => {
		// The regression this check exists for. Location was correct; only the
		// status was wrong, so anything comparing URLs alone would have passed.
		const [failure] = verifyTrailingSlashRedirects([probe({ status: 307, location: "/about" })]);

		expect(failure?.reason).toContain("307");
		expect(failure?.reason).toContain("run_worker_first");
	});

	it("rejects a 302 for the same reason", () => {
		expect(verifyTrailingSlashRedirects([probe({ status: 302 })])).toHaveLength(1);
	});

	it("rejects a 200, which means the slash form is a second live URL", () => {
		const [failure] = verifyTrailingSlashRedirects([probe({ status: 200, location: null })]);

		expect(failure?.reason).toContain("200");
	});

	it("rejects a redirect that lands somewhere other than the canonical path", () => {
		const [failure] = verifyTrailingSlashRedirects([probe({ location: "/somewhere-else" })]);

		expect(failure?.reason).toContain("/somewhere-else");
	});

	it("rejects a redirect with no Location at all", () => {
		expect(verifyTrailingSlashRedirects([probe({ location: null })])).toHaveLength(1);
	});

	it("reports every failing probe, not just the first", () => {
		const failures = verifyTrailingSlashRedirects([
			probe({ url: "https://auditmos.com/about/", status: 307 }),
			probe({ url: "https://auditmos.com/contact/", status: 307 }),
		]);

		expect(failures.map((failure) => failure.url)).toEqual([
			"https://auditmos.com/about/",
			"https://auditmos.com/contact/",
		]);
	});
});

describe("formatRedirectReport", () => {
	it("confirms the count when everything passes", () => {
		expect(formatRedirectReport([], 9)).toContain("all 9");
	});

	it("names the URL and the reason for each failure", () => {
		const failures = verifyTrailingSlashRedirects([probe({ status: 307 })]);
		const output = formatRedirectReport(failures, 9);

		expect(output).toContain("REGRESSED");
		expect(output).toContain("https://auditmos.com/about/");
	});

	it("does not report success when there was nothing to probe", () => {
		// An empty sitemap must not read as a clean bill of health.
		const output = formatRedirectReport([], 0);

		expect(output).not.toContain("OK");
		expect(output).toContain("unverified");
	});
});
