import { claimsPath } from "./run-worker-first";

describe("claimsPath", () => {
	it("claims the exact path a literal pattern names", () => {
		expect(claimsPath(["/about"], "/about")).toBe(true);
	});

	it("does NOT claim the trailing-slash form of a literal pattern", () => {
		// The whole of issue #38 in one assertion. `/about` reads as if it covers
		// the page, so `/about/` was left to the asset server, which answers it
		// with a 307 instead of the 301 the site declares canonical.
		expect(claimsPath(["/about"], "/about/")).toBe(false);
	});

	it("claims both forms once both are listed", () => {
		expect(claimsPath(["/about", "/about/"], "/about")).toBe(true);
		expect(claimsPath(["/about", "/about/"], "/about/")).toBe(true);
	});

	it("claims everything under a wildcard, including the bare slash form", () => {
		// Why `/work/` and `/work/<slug>/` already 301 while every other page's
		// slash form does not: `/work/*` is the one wildcard in the list.
		expect(claimsPath(["/work/*"], "/work/")).toBe(true);
		expect(claimsPath(["/work/*"], "/work/a-slug")).toBe(true);
		expect(claimsPath(["/work/*"], "/work/a-slug/")).toBe(true);
	});

	it("does not let a wildcard claim the prefix that precedes its slash", () => {
		expect(claimsPath(["/work/*"], "/work")).toBe(false);
	});

	it("does not let a literal pattern claim a longer path that starts with it", () => {
		// `/about` must not swallow a future `/about-us` — the reason the fix is
		// an explicit second entry rather than an `/about*` wildcard.
		expect(claimsPath(["/about"], "/about-us")).toBe(false);
		expect(claimsPath(["/about"], "/about/team")).toBe(false);
	});

	it("treats the root as a literal, not a prefix", () => {
		expect(claimsPath(["/"], "/")).toBe(true);
		expect(claimsPath(["/"], "/about")).toBe(false);
	});

	it("matches a literal dot rather than any character", () => {
		expect(claimsPath(["/llms.txt"], "/llms.txt")).toBe(true);
		expect(claimsPath(["/llms.txt"], "/llmsxtxt")).toBe(false);
	});

	it("is satisfied by any one pattern in the list", () => {
		expect(claimsPath(["/about", "/work/*"], "/work/a-slug")).toBe(true);
		expect(claimsPath(["/about", "/work/*"], "/contact")).toBe(false);
	});

	it("claims nothing when the list is empty", () => {
		expect(claimsPath([], "/about")).toBe(false);
	});
});
