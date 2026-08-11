/**
 * The contract that lets more than one test file assert against a real build.
 *
 * Every case here drives a fake builder against a throwaway state directory, so
 * the protocol is exercised without paying for `astro build` — the real builder
 * is wired in by `build-output.ts` and observed by the suites that use it.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { buildOnce, buildRunCount, clearBuildState } from "./build-once";

let stateDir: string;

beforeEach(() => {
	stateDir = mkdtempSync(join(tmpdir(), "build-once-"));
});

afterEach(() => {
	rmSync(stateDir, { recursive: true, force: true });
});

/** A builder whose completion the test decides, so a lock can be held open. */
function heldBuilder(): { build: () => Promise<void>; finish: () => void } {
	let finish!: () => void;
	const build = () =>
		new Promise<void>((resolve) => {
			finish = resolve;
		});

	return { build, finish: () => finish() };
}

describe("buildOnce", () => {
	it("runs the build for the first caller", async () => {
		let runs = 0;

		await buildOnce(
			async () => {
				runs++;
			},
			{ stateDir },
		);

		expect(runs).toBe(1);
	});

	it("runs the build exactly once when callers race for the lock", async () => {
		// The race this closes: vitest runs test files in parallel isolated
		// workers, so two suites reach `beforeAll` at the same moment and would
		// otherwise each empty and rewrite `dist/` under the other one's reads.
		let runs = 0;
		const build = async () => {
			runs++;
			await delay(20);
		};

		await Promise.all(Array.from({ length: 8 }, () => buildOnce(build, { stateDir, pollMs: 1 })));

		expect(runs).toBe(1);
	});

	it("skips the build entirely for callers that arrive after it finished", async () => {
		let runs = 0;
		const build = async () => {
			runs++;
		};

		await buildOnce(build, { stateDir });
		await buildOnce(build, { stateDir });
		await buildOnce(build, { stateDir });

		expect(runs).toBe(1);
	});

	it("counts the builds a run actually started", async () => {
		expect(buildRunCount(stateDir)).toBe(0);

		await buildOnce(async () => {}, { stateDir });
		await buildOnce(async () => {}, { stateDir });

		expect(buildRunCount(stateDir)).toBe(1);
	});

	it("builds again once the state has been cleared", async () => {
		let runs = 0;
		const build = async () => {
			runs++;
		};

		await buildOnce(build, { stateDir });
		clearBuildState(stateDir);
		await buildOnce(build, { stateDir });

		expect(runs).toBe(2);
		expect(buildRunCount(stateDir)).toBe(1);
	});

	it("does not hang on a lock a killed run left behind", async () => {
		// A SIGKILLed run leaves the lock taken and the marker unwritten. Clearing
		// the state at the start of the next run is what makes that recoverable
		// without a human deleting a directory.
		const stale = heldBuilder();
		const abandoned = buildOnce(stale.build, { stateDir });
		await delay(20);

		clearBuildState(stateDir);

		let runs = 0;
		await buildOnce(
			async () => {
				runs++;
			},
			{ stateDir, timeoutMs: 2_000, pollMs: 5 },
		);

		expect(runs).toBe(1);

		stale.finish();
		await abandoned;
	});

	it("gives up rather than waiting forever on a lock that is never released", async () => {
		const stale = heldBuilder();
		const abandoned = buildOnce(stale.build, { stateDir });
		await delay(20);

		await expect(
			buildOnce(async () => {}, { stateDir, timeoutMs: 100, pollMs: 5 }),
		).rejects.toThrow(/lock/i);

		stale.finish();
		await abandoned;
	});

	it("surfaces a failing build to the caller that ran it", async () => {
		await expect(
			buildOnce(
				async () => {
					throw new Error("astro build exploded");
				},
				{ stateDir },
			),
		).rejects.toThrow("astro build exploded");
	});

	it("releases the lock when the build fails, so a later caller can retry", async () => {
		await expect(
			buildOnce(
				async () => {
					throw new Error("astro build exploded");
				},
				{ stateDir, timeoutMs: 2_000, pollMs: 5 },
			),
		).rejects.toThrow("astro build exploded");

		let runs = 0;
		await buildOnce(
			async () => {
				runs++;
			},
			{ stateDir, timeoutMs: 2_000, pollMs: 5 },
		);

		expect(runs).toBe(1);
		expect(buildRunCount(stateDir)).toBe(2);
	});
});
