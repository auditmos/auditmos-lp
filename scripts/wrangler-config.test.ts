/**
 * Contract test for wrangler.jsonc observability block.
 *
 * Cloudflare's Workers best-practices doc calls out sampling rate as a
 * deliberate production knob. Defaulting works, but for a template repo
 * that may be deployed at meaningful traffic we surface the value
 * explicitly so future tuning is a one-character edit instead of a
 * research task. See issue #4.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripJsonc } from "./init-project-lib";

type WranglerConfig = {
	observability?: { enabled?: boolean; head_sampling_rate?: unknown };
	env?: Record<string, { name?: string; routes?: { pattern?: string; custom_domain?: boolean }[] }>;
};

const wranglerConfig = JSON.parse(
	stripJsonc(readFileSync(resolve(import.meta.dirname, "..", "wrangler.jsonc"), "utf8")),
) as WranglerConfig;
const varsExamples = [
	".dev.vars.example",
	".dev.vars.staging.example",
	".dev.vars.production.example",
].map((fileName) => ({
	fileName,
	source: readFileSync(resolve(import.meta.dirname, "..", fileName), "utf8"),
}));

describe("wrangler.jsonc observability", () => {
	const observability = wranglerConfig.observability;

	it("is enabled", () => {
		expect(observability?.enabled).toBe(true);
	});

	it("declares head_sampling_rate explicitly", () => {
		expect(observability?.head_sampling_rate).toBeDefined();
	});

	it("sets head_sampling_rate to a number in (0, 1]", () => {
		const rate = observability?.head_sampling_rate;
		expect(typeof rate).toBe("number");
		expect(rate).toBeGreaterThan(0);
		expect(rate).toBeLessThanOrEqual(1);
	});
});

describe("wrangler.jsonc deployment envs", () => {
	it("declares dev, staging, and production with distinct Worker names", () => {
		expect(wranglerConfig.env).toMatchObject({
			dev: { name: "auditmos-lp-dev" },
			staging: { name: "auditmos-lp-staging" },
			production: { name: "auditmos-lp-production" },
		});

		const names = Object.values(wranglerConfig.env ?? {}).map((env) => env.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("maps staging.auditmos.com as a custom domain", () => {
		expect(wranglerConfig.env?.staging?.routes).toContainEqual({
			pattern: "staging.auditmos.com",
			custom_domain: true,
		});
	});
});

describe("per-environment vars examples", () => {
	it.each([
		"TURNSTILE_SITE_KEY",
		"RESEND_API_KEY",
		"TURNSTILE_SECRET_KEY",
		"CONTACT_TO_EMAIL",
	])("declares %s for every environment", (varName) => {
		for (const example of varsExamples) {
			expect(example.source, example.fileName).toContain(`${varName}=`);
		}
	});
});
