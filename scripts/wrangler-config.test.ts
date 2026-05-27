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

const wranglerConfig = JSON.parse(
	stripJsonc(readFileSync(resolve(import.meta.dirname, "..", "wrangler.jsonc"), "utf8")),
) as { observability?: { enabled?: boolean; head_sampling_rate?: unknown } };

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
